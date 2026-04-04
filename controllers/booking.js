const Booking = require("../models/booking");
const Listing = require("../models/listing");
const User = require("../models/user");

// ── Razorpay refund helper ────────────────────────────────
function getRazorpay() {
  const Razorpay = require("razorpay");
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

async function processRazorpayRefund(booking, refundAmount, reason) {
  const razorpay = getRazorpay();
  return await razorpay.payments.refund(booking.razorpayPaymentId, {
    amount: refundAmount * 100,   // paise
    speed: "normal",
    notes: { bookingId: booking._id.toString(), reason },
  });
}

// ─────────────────────────────────────────────────────────
// GET /bookings/my?filter=upcoming|cancelled|refund
// ─────────────────────────────────────────────────────────
module.exports.myBookings = async (req, res) => {
  const { filter } = req.query;

  let query = { user: req.user._id };

  if (filter === "upcoming") query.status = "upcoming";
  if (filter === "cancelled") query.status = { $in: ["cancelled", "unavailable"] };
  if (filter === "refund") query.paymentStatus = { $in: ["refund_initiated", "refunded", "refund_failed"] };

  const bookings = await Booking.find(query)
    .populate("listing")
    .sort({ createdAt: -1 });

  res.render("bookings/my-bookings", { bookings, query: req.query });
};

// ─────────────────────────────────────────────────────────
// GET /bookings/:id
// ─────────────────────────────────────────────────────────
module.exports.bookingDetail = async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("listing")
    .populate("user");

  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/my");
  }
  if (!booking.user._id.equals(req.user._id) && req.user.role !== "admin") {
    req.flash("error", "Access denied");
    return res.redirect("/bookings/my");
  }

  const refundPolicy = booking.getRefundPolicy();
  res.render("bookings/detail", { booking, refundPolicy });
};

// ─────────────────────────────────────────────────────────
// GET /bookings/:id/cancel-preview
// ─────────────────────────────────────────────────────────
module.exports.cancelPreview = async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate("listing");

  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/my");
  }
  if (!booking.user.equals(req.user._id) && req.user.role !== "admin") {
    req.flash("error", "Access denied");
    return res.redirect("/bookings/my");
  }
  if (booking.status !== "upcoming") {
    req.flash("error", "This booking cannot be cancelled");
    return res.redirect(`/bookings/${booking._id}`);
  }

  const refundPolicy = booking.getRefundPolicy();
  const refundAmount = Math.round(booking.totalPrice * refundPolicy.percentage / 100);

  res.render("bookings/cancel-preview", { booking, refundPolicy, refundAmount });
};

// ─────────────────────────────────────────────────────────
// POST /bookings/:id/cancel
// ─────────────────────────────────────────────────────────
module.exports.cancelBooking = async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/bookings/my");
  }
  if (!booking.user.equals(req.user._id) && req.user.role !== "admin") {
    req.flash("error", "Access denied");
    return res.redirect("/bookings/my");
  }
  if (booking.status !== "upcoming") {
    req.flash("error", "Only upcoming bookings can be cancelled");
    return res.redirect("/bookings/my");
  }

  const refundPolicy = booking.getRefundPolicy();
  const refundAmount = Math.round(booking.totalPrice * refundPolicy.percentage / 100);
  const cancelledBy = req.user.role === "admin" ? "admin" : "user";
  const reason = req.body.reason?.trim() || "User requested cancellation";

  // ── Mark cancelled ───────────────────────────────────
  booking.status = "cancelled";
  booking.cancellation = {
    cancelledBy,
    cancelledAt: new Date(),
    reason,
    policyApplied: refundPolicy.percentage === 100 ? "full"
      : refundPolicy.percentage === 50 ? "partial" : "none",
  };

  // ── Refund via Razorpay ──────────────────────────────
  if (refundAmount > 0 && booking.razorpayPaymentId) {
    try {
      const refund = await processRazorpayRefund(booking, refundAmount, reason);

      booking.paymentStatus = "refund_initiated";
      booking.refund = {
        razorpayRefundId: refund.id,
        amount: refundAmount,
        percentage: refundPolicy.percentage,
        reason: "user_cancel",
        initiatedAt: new Date(),
        status: "initiated",
      };

      await booking.save();

      req.flash("success",
        `Booking cancelled. ₹${refundAmount.toLocaleString("en-IN")} refund initiated — ` +
        `expect it within 5–7 business days. Refund ID: ${refund.id}`
      );
      console.log(`✅ Refund initiated: ${refund.id} | ₹${refundAmount} | Booking: ${booking._id}`);

    } catch (refundErr) {
      console.error("❌ Razorpay refund failed:", refundErr.message);
      booking.paymentStatus = "refund_failed";
      booking.refund = {
        amount: refundAmount,
        percentage: refundPolicy.percentage,
        reason: "user_cancel",
        initiatedAt: new Date(),
        status: "failed",
        failureReason: refundErr.message,
      };
      await booking.save();
      req.flash("error",
        `Booking cancelled. Automatic refund failed — our team will manually process ` +
        `₹${refundAmount.toLocaleString("en-IN")} within 3–5 business days. ` +
        `Reference ID: ${booking._id.toString().slice(-8).toUpperCase()}`
      );
    }

  } else if (refundAmount === 0) {
    await booking.save();
    req.flash("success", "Booking cancelled. No refund applies as per our cancellation policy (within 24 hours of check-in).");

  } else {
    await booking.save();
    req.flash("success", "Booking cancelled.");
  }

  res.redirect("/bookings/my");
};

// ─────────────────────────────────────────────────────────
// POST /bookings/:id/unavailable  (host action)
// Full refund auto-triggered
// ─────────────────────────────────────────────────────────
module.exports.markUnavailable = async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate("listing");

  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("back");
  }

  const isOwner = booking.listing.owner.equals(req.user._id);
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) {
    req.flash("error", "Access denied");
    return res.redirect("back");
  }
  if (booking.status !== "upcoming") {
    req.flash("error", "This booking cannot be changed");
    return res.redirect("back");
  }

  const reason = req.body.reason?.trim() || "Listing unavailable — host cancelled";

  booking.status = "unavailable";
  booking.cancellation = {
    cancelledBy: "host",
    cancelledAt: new Date(),
    reason,
    policyApplied: "full",
  };

  if (booking.razorpayPaymentId) {
    try {
      const refund = await processRazorpayRefund(booking, booking.totalPrice, "host_unavailable");

      booking.paymentStatus = "refund_initiated";
      booking.refund = {
        razorpayRefundId: refund.id,
        amount: booking.totalPrice,
        percentage: 100,
        reason: "host_unavailable",
        initiatedAt: new Date(),
        status: "initiated",
      };

      console.log(`✅ Full refund (host cancel): ${refund.id} | ₹${booking.totalPrice}`);
      req.flash("success",
        `Booking cancelled. Full refund of ₹${booking.totalPrice.toLocaleString("en-IN")} initiated for the guest.`
      );
    } catch (err) {
      console.error("❌ Auto-refund failed (host cancel):", err.message);
      booking.paymentStatus = "refund_failed";
      booking.refund = {
        amount: booking.totalPrice,
        percentage: 100,
        reason: "host_unavailable",
        initiatedAt: new Date(),
        status: "failed",
        failureReason: err.message,
      };
      req.flash("error", "Booking cancelled but auto-refund failed. Admin will process manually.");
    }
  }

  await booking.save();
  res.redirect("back");
};

// ─────────────────────────────────────────────────────────
// POST /bookings/:id/refund  (admin manual refund)
// ─────────────────────────────────────────────────────────
module.exports.adminRefund = async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    req.flash("error", "Booking not found");
    return res.redirect("/admin/bookings");
  }
  if (!booking.razorpayPaymentId) {
    req.flash("error", "No Razorpay payment ID on this booking");
    return res.redirect("/admin/bookings");
  }
  if (booking.paymentStatus === "refunded") {
    req.flash("error", "This booking has already been refunded");
    return res.redirect("/admin/bookings");
  }

  if (booking.paymentStatus === "refund_initiated") {
    req.flash("error", "Refund is already in progress");
    return res.redirect("/admin/bookings");
  }

  const amount = parseInt(req.body.amount) || booking.totalPrice;

  try {
    const refund = await processRazorpayRefund(booking, amount, "admin_manual_refund");

    booking.paymentStatus = "refund_initiated";
    booking.refund = booking.refund || {};
    booking.refund.razorpayRefundId = refund.id;
    booking.refund.amount = amount;
    booking.refund.reason = "admin";
    booking.refund.initiatedAt = new Date();
    booking.refund.status = "initiated";
    delete booking.refund.failureReason;

    await booking.save();
    req.flash("success", `Refund of ₹${amount.toLocaleString("en-IN")} initiated. Refund ID: ${refund.id}`);

  } catch (err) {
    console.error("REFUND ERROR:", err); // 🔥 ALWAYS LOG

    const message =
      err?.error?.description ||   // Razorpay style
      err?.message ||              // Normal error
      "Unknown error occurred";    // fallback

    req.flash("error", `Refund failed: ${message}`);
    res.redirect("/admin/bookings");
  }

  res.redirect("/admin/bookings");
};

// ─────────────────────────────────────────────────────────
// POST /bookings/webhook  (Razorpay webhook)
// ─────────────────────────────────────────────────────────
module.exports.refundWebhook = async (req, res) => {
  const crypto = require("crypto");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const sig = req.headers["x-razorpay-signature"];
  const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(req.body)).digest("hex");

  if (sig !== expected) {
    console.error("Webhook signature mismatch");
    return res.status(400).json({ status: "invalid signature" });
  }

  const event = req.body;

  if (event.event === "refund.processed") {
    const refundId = event.payload.refund?.entity?.id;
    if (refundId) {
      await Booking.findOneAndUpdate(
        { "refund.razorpayRefundId": refundId },
        { paymentStatus: "refunded", "refund.status": "processed", "refund.processedAt": new Date() }
      );
      console.log(`✅ Webhook: Refund ${refundId} marked as processed`);
    }
  }

  if (event.event === "refund.failed") {
    const refundId = event.payload.refund?.entity?.id;
    if (refundId) {
      await Booking.findOneAndUpdate(
        { "refund.razorpayRefundId": refundId },
        {
          paymentStatus: "refund_failed",
          "refund.status": "failed",
          "refund.failureReason": event.payload.refund?.entity?.description || "Unknown",
        }
      );
      console.warn(`⚠️ Webhook: Refund ${refundId} failed`);
    }
  }

  res.json({ status: "ok" });
};

module.exports.createBooking = async (req, res) => {
  req.flash("error", "Please use the payment flow to book");
  res.redirect("/listings");
};
