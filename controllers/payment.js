const crypto  = require("crypto");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const User    = require("../models/user");

function getRazorpay() {
  const Razorpay = require("razorpay");
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay keys not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env");
  }
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// ─────────────────────────────────────────────────────────
// STEP 1 — Show checkout summary page
//   GET /api/payment/checkout?listingId=&checkIn=&checkOut=&guests=
// ─────────────────────────────────────────────────────────
module.exports.checkoutPage = async (req, res) => {
  const { listingId, checkIn, checkOut, guests } = req.query;

  if (!listingId || !checkIn || !checkOut || !guests) {
    req.flash("error", "Incomplete booking details. Please select dates and guests.");
    return res.redirect("back");
  }

  const listing = await Listing.findById(listingId).populate("owner");
  if (!listing) {
    req.flash("error", "Listing not found.");
    return res.redirect("/listings");
  }

  const checkInDate  = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  if (isNaN(checkInDate) || isNaN(checkOutDate) || checkOutDate <= checkInDate) {
    req.flash("error", "Invalid dates. Check-out must be after check-in.");
    return res.redirect(`/listings/${listingId}`);
  }

  const nights = Math.ceil((checkOutDate - checkInDate) / 86400000);
  if (nights < 1 || nights > 7) {
    req.flash("error", "Stay must be between 1 and 7 nights.");
    return res.redirect(`/listings/${listingId}`);
  }
  if (parseInt(guests) < 1 || parseInt(guests) > 4) {
    req.flash("error", "Guests must be between 1 and 4.");
    return res.redirect(`/listings/${listingId}`);
  }

  // Check overlap
  const overlap = await Booking.findOne({
    listing: listingId,
    paymentStatus: "paid",
    status: { $ne: "cancelled" },
    checkIn:  { $lt: checkOutDate },
    checkOut: { $gt: checkInDate },
  });
  if (overlap) {
    req.flash("error", "These dates are already booked. Please choose different dates.");
    return res.redirect(`/listings/${listingId}`);
  }

  const totalPrice    = nights * listing.price;
  const serviceFee    = Math.round(totalPrice * 0.05);   // 5% service fee
  const grandTotal    = totalPrice + serviceFee;

  res.render("payment/checkout", {
    listing,
    checkIn,
    checkOut,
    checkInDate,
    checkOutDate,
    guests: parseInt(guests),
    nights,
    pricePerNight: listing.price,
    totalPrice,
    serviceFee,
    grandTotal,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
  });
};

// ─────────────────────────────────────────────────────────
// STEP 2 — Create Razorpay order (POST from checkout page)
//   POST /api/payment/create-order
// ─────────────────────────────────────────────────────────
module.exports.createOrder = async (req, res) => {
  try {
    const { listingId, checkIn, checkOut, guests } = req.body;

    if (!listingId || !checkIn || !checkOut || !guests) {
      return res.status(400).json({ success: false, message: "Missing required booking details" });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Listing not found" });
    }

    const checkInDate  = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate) || isNaN(checkOutDate) || checkOutDate <= checkInDate) {
      return res.status(400).json({ success: false, message: "Invalid dates selected" });
    }

    const nights = Math.ceil((checkOutDate - checkInDate) / 86400000);
    if (nights < 1 || nights > 7) {
      return res.status(400).json({ success: false, message: "Stay must be between 1 and 7 nights" });
    }
    if (parseInt(guests) < 1 || parseInt(guests) > 4) {
      return res.status(400).json({ success: false, message: "Guests must be 1–4" });
    }

    // Re-check overlap
    const overlap = await Booking.findOne({
      listing: listingId,
      paymentStatus: "paid",
      status: { $ne: "cancelled" },
      checkIn:  { $lt: checkOutDate },
      checkOut: { $gt: checkInDate },
    });
    if (overlap) {
      return res.status(400).json({ success: false, message: "These dates are already booked." });
    }

    const totalPrice = nights * listing.price;
    const serviceFee = Math.round(totalPrice * 0.05);
    const grandTotal = totalPrice + serviceFee;

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount:   grandTotal * 100,  // paise
      currency: "INR",
      receipt:  `hk_${Date.now()}`,
      notes: {
        listingId:  listingId.toString(),
        userId:     req.user._id.toString(),
        nights:     nights.toString(),
        checkIn,
        checkOut,
        guests:     guests.toString(),
      },
    });

    res.json({
      success:    true,
      orderId:    order.id,
      amount:     grandTotal * 100,
      currency:   "INR",
      nights,
      totalPrice,
      serviceFee,
      grandTotal,
    });

  } catch (err) {
    console.error("Create order error:", err.message);
    res.status(500).json({ success: false, message: err.message || "Failed to create order" });
  }
};

// ─────────────────────────────────────────────────────────
// STEP 3 — Verify payment + create booking (POST)
//   POST /api/payment/verify
// ─────────────────────────────────────────────────────────
module.exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      listingId,
      checkIn,
      checkOut,
      guests,
      nights,
      grandTotal,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment credentials" });
    }

    // ── Verify HMAC signature ──────────────────────────
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      console.error("❌ Signature mismatch — possible tampering");
      return res.status(400).json({
        success: false,
        message: "Payment verification failed. Contact support with Payment ID: " + razorpay_payment_id,
      });
    }

    // ── Prevent duplicate booking ──────────────────────
    const existing = await Booking.findOne({ razorpayOrderId: razorpay_order_id });
    if (existing) {
      return res.json({
        success:         true,
        bookingId:       existing._id,
        confirmationUrl: `/api/payment/confirmation/${existing._id}`,
      });
    }

    // ── Create booking ONLY after verified ────────────
    const booking = new Booking({
      user:               req.user._id,
      listing:            listingId,
      checkIn:            new Date(checkIn),
      checkOut:           new Date(checkOut),
      guests:             parseInt(guests),
      nights:             parseInt(nights),
      totalPrice:         parseInt(grandTotal),
      paymentStatus:      "paid",
      razorpayOrderId:    razorpay_order_id,
      razorpayPaymentId:  razorpay_payment_id,
      razorpaySignature:  razorpay_signature,
      status:             "upcoming",
    });

    await booking.save();
    await User.findByIdAndUpdate(req.user._id, { $push: { bookings: booking._id } });

    console.log(`✅ Booking confirmed: ${booking._id} | Payment: ${razorpay_payment_id}`);

    res.json({
      success:         true,
      bookingId:       booking._id,
      confirmationUrl: `/api/payment/confirmation/${booking._id}`,
    });

  } catch (err) {
    console.error("Verify payment error:", err.message);
    res.status(500).json({ success: false, message: "Verification error. Please contact support." });
  }
};

// ─────────────────────────────────────────────────────────
// STEP 4 — Booking confirmation page
//   GET /api/payment/confirmation/:bookingId
// ─────────────────────────────────────────────────────────
module.exports.confirmationPage = async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId)
    .populate("listing")
    .populate("user");

  if (!booking) {
    req.flash("error", "Booking not found.");
    return res.redirect("/bookings/my");
  }

  // Only the booking owner can see this page
  if (!booking.user._id.equals(req.user._id) && req.user.role !== "admin") {
    req.flash("error", "Access denied.");
    return res.redirect("/bookings/my");
  }

  res.render("payment/confirmation", { booking });
};
