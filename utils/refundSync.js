const Booking = require("../models/booking");

// Refund status normally arrives via the Razorpay webhook, but webhooks can't
// reach localhost and can be missed in production. These helpers ask Razorpay
// directly and bring "refund_initiated" bookings up to date.

function getRazorpay() {
  const Razorpay = require("razorpay");
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

/**
 * Fetch one booking's refund from Razorpay and update the booking if its
 * status changed. Returns the Razorpay status ("pending" | "processed" | "failed").
 * `booking` must be a Mongoose document (not lean).
 */
async function syncRefundStatus(booking, razorpay = getRazorpay()) {
  const refundId = booking.refund?.razorpayRefundId;
  if (!refundId || booking.paymentStatus !== "refund_initiated") return null;

  const refund = await razorpay.refunds.fetch(refundId);

  if (refund.status === "processed") {
    booking.paymentStatus = "refunded";
    booking.refund.status = "processed";
    booking.refund.processedAt = booking.refund.processedAt || new Date();
    await booking.save();
  } else if (refund.status === "failed") {
    booking.paymentStatus = "refund_failed";
    booking.refund.status = "failed";
    booking.refund.failureReason = booking.refund.failureReason || "Refund failed at Razorpay";
    await booking.save();
  }
  return refund.status;
}

/**
 * Sync every pending refund matching `filter` (e.g. one user's bookings).
 * Never throws and gives up after `timeoutMs` so a slow Razorpay API can't
 * block the page that called it.
 */
async function syncPendingRefunds(filter = {}, { limit = 25, timeoutMs = 5000 } = {}) {
  const work = (async () => {
    const pending = await Booking.find({
      ...filter,
      paymentStatus: "refund_initiated",
      "refund.razorpayRefundId": { $exists: true, $ne: null },
    }).limit(limit);
    if (pending.length === 0) return;

    const razorpay = getRazorpay();
    const results = await Promise.allSettled(pending.map(b => syncRefundStatus(b, razorpay)));
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        const msg = r.reason?.error?.description || r.reason?.message || r.reason;
        console.error(`Refund sync failed for booking ${pending[i]._id}:`, msg);
      }
    });
  })().catch(err => console.error("Refund sync error:", err.message));

  const timeout = new Promise(resolve => setTimeout(resolve, timeoutMs));
  await Promise.race([work, timeout]);
}

module.exports = { syncRefundStatus, syncPendingRefunds };
