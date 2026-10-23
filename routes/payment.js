const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment");
const { isLoggedIn, requireVerifiedEmail } = require("../middlewares/authenticate");
const wrapAsync = require("../utils/wrapAsync");
const { checkoutLimiter } = require("../middlewares/rateLimit");

// GET: Checkout page (summary before paying)
router.get("/checkout", isLoggedIn, requireVerifiedEmail, wrapAsync(paymentController.checkoutPage));

// POST: Create Razorpay order (called from checkout page)
router.post("/create-order", isLoggedIn, requireVerifiedEmail, checkoutLimiter, wrapAsync(paymentController.createOrder));

// POST: Verify payment + create booking
router.post("/verify", isLoggedIn, wrapAsync(paymentController.verifyPayment));

// GET: Booking confirmation page (after success)
router.get("/confirmation/:bookingId", isLoggedIn, wrapAsync(paymentController.confirmationPage));

router.get("/back", (req, res) => {
  res.send("Back route working ✅");
});
module.exports = router;
