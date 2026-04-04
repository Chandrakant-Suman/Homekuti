const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment");
const { isLoggedIn } = require("../middlewares/authenticate");
const wrapAsync = require("../utils/wrapAsync");

// GET: Checkout page (summary before paying)
router.get("/checkout", isLoggedIn, wrapAsync(paymentController.checkoutPage));

// POST: Create Razorpay order (called from checkout page)
router.post("/create-order", isLoggedIn, wrapAsync(paymentController.createOrder));

// POST: Verify payment + create booking
router.post("/verify", isLoggedIn, wrapAsync(paymentController.verifyPayment));

// GET: Booking confirmation page (after success)
router.get("/confirmation/:bookingId", isLoggedIn, wrapAsync(paymentController.confirmationPage));

router.get("/back", (req, res) => {
  res.send("Back route working ✅");
});
module.exports = router;
