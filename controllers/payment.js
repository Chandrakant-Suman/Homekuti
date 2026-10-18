const crypto  = require("crypto");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const User    = require("../models/user");
const { MAX_GUESTS, computePrice, validateGuestDetails } = require("../utils/pricing");

const PENDING_ORDER_TTL_MS = 60 * 60 * 1000; // checkout data kept for 1 hour

/**
 * Validate the trip parameters shared by checkout and order creation.
 * Returns { error } or { listing, checkInDate, checkOutDate, nights, guests }.
 */
async function validateTrip({ listingId, checkIn, checkOut, guests }, { populateOwner = false } = {}) {
  if (!listingId || !checkIn || !checkOut || !guests) {
    return { error: "Incomplete booking details. Please select dates and guests." };
  }
  const query = Listing.findById(listingId);
  const listing = await (populateOwner ? query.populate("owner") : query);
  if (!listing) return { error: "Listing not found.", notFound: true };

  const checkInDate  = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (isNaN(checkInDate) || isNaN(checkOutDate) || checkOutDate <= checkInDate) {
    return { error: "Invalid dates. Check-out must be after check-in." };
  }
  const nights = Math.ceil((checkOutDate - checkInDate) / 86400000);
  if (nights < 1 || nights > 7) return { error: "Stay must be between 1 and 7 nights." };

  const guestCount = parseInt(guests, 10);
  if (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > MAX_GUESTS) {
    return { error: `Guests must be between 1 and ${MAX_GUESTS}.` };
  }

  const overlap = await Booking.findOne({
    listing: listingId,
    paymentStatus: "paid",
    status: { $ne: "cancelled" },
    checkIn:  { $lt: checkOutDate },
    checkOut: { $gt: checkInDate },
  });
  if (overlap) return { error: "These dates are already booked. Please choose different dates." };

  return { listing, checkInDate, checkOutDate, nights, guests: guestCount };
}

function priceSnapshot(price) {
  const { pricePerNight, baseGuests, extraGuests, extraGuestPercent,
          extraGuestFeePerNight, baseTotal, extraGuestTotal, gstRate, gst, serviceFee } = price;
  return { pricePerNight, baseGuests, extraGuests, extraGuestPercent,
           extraGuestFeePerNight, baseTotal, extraGuestTotal, gstRate, gst, serviceFee };
}

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
  const { listingId, checkIn, checkOut } = req.query;
  const trip = await validateTrip(req.query, { populateOwner: true });

  if (trip.error) {
    req.flash("error", trip.error);
    return res.redirect(trip.notFound || !listingId ? "/listings" : `/listings/${listingId}`);
  }

  const { listing, checkInDate, checkOutDate, nights, guests } = trip;
  const price = computePrice(listing, nights, guests);

  res.render("payment/checkout", {
    listing,
    checkIn,
    checkOut,
    checkInDate,
    checkOutDate,
    guests,
    nights,
    price,
    pricePerNight: price.pricePerNight,
    totalPrice: price.subtotal,
    serviceFee: price.serviceFee,
    grandTotal: price.grandTotal,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
  });
};

// ─────────────────────────────────────────────────────────
// STEP 2 — Create Razorpay order (POST from checkout page)
//   POST /api/payment/create-order
// ─────────────────────────────────────────────────────────
module.exports.createOrder = async (req, res) => {
  try {
    const { listingId, checkIn, checkOut, guestDetails } = req.body;

    const trip = await validateTrip(req.body);
    if (trip.error) {
      return res.status(trip.notFound ? 404 : 400).json({ success: false, message: trip.error });
    }
    const { listing, nights, guests } = trip;

    const checked = validateGuestDetails(guestDetails, guests);
    if (checked.error) {
      return res.status(400).json({ success: false, message: checked.error });
    }

    const price = computePrice(listing, nights, guests);

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount:   price.grandTotal * 100,  // paise
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

    // Keep the server-computed booking for /verify (never trust the client there)
    const now = Date.now();
    const pending = req.session.pendingOrders || {};
    for (const [id, p] of Object.entries(pending)) {
      if (now - p.createdAt > PENDING_ORDER_TTL_MS) delete pending[id];
    }
    pending[order.id] = {
      listingId: listingId.toString(),
      checkIn,
      checkOut,
      guests,
      nights,
      guestDetails: checked.guests,
      price,
      createdAt: now,
    };
    req.session.pendingOrders = pending;
    await new Promise((resolve, reject) => req.session.save(err => (err ? reject(err) : resolve())));

    res.json({
      success:    true,
      orderId:    order.id,
      amount:     price.grandTotal * 100,
      currency:   "INR",
      nights,
      totalPrice: price.subtotal,
      serviceFee: price.serviceFee,
      grandTotal: price.grandTotal,
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
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

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

    // ── Booking details come from the server, not the request body ──
    let pending = req.session.pendingOrders?.[razorpay_order_id];
    if (!pending) {
      // Session lost (expired / other device): rebuild from the Razorpay order
      // so a captured payment is never dropped. Guest details are unavailable.
      const order = await getRazorpay().orders.fetch(razorpay_order_id);
      const n = order.notes || {};
      if (n.userId !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: "This payment belongs to a different account." });
      }
      const listing = await Listing.findById(n.listingId);
      const nightsN = parseInt(n.nights, 10);
      const guestsN = parseInt(n.guests, 10);
      const price = listing ? computePrice(listing, nightsN, guestsN) : {};
      pending = {
        listingId: n.listingId, checkIn: n.checkIn, checkOut: n.checkOut,
        guests: guestsN, nights: nightsN, guestDetails: [],
        price: { ...price, grandTotal: order.amount / 100 },
      };
    }

    // ── Create booking ONLY after verified ────────────
    const booking = new Booking({
      user:               req.user._id,
      listing:            pending.listingId,
      checkIn:            new Date(pending.checkIn),
      checkOut:           new Date(pending.checkOut),
      guests:             pending.guests,
      nights:             pending.nights,
      guestDetails:       pending.guestDetails,
      priceBreakdown:     priceSnapshot(pending.price),
      totalPrice:         pending.price.grandTotal,
      paymentStatus:      "paid",
      razorpayOrderId:    razorpay_order_id,
      razorpayPaymentId:  razorpay_payment_id,
      razorpaySignature:  razorpay_signature,
      status:             "upcoming",
    });

    await booking.save();
    await User.findByIdAndUpdate(req.user._id, { $push: { bookings: booking._id } });

    if (req.session.pendingOrders) delete req.session.pendingOrders[razorpay_order_id];

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
