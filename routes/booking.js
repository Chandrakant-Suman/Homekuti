const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/booking");
const { isLoggedIn } = require("../middlewares/authenticate");
const { isAdmin }    = require("../middlewares/authorize");
const wrapAsync      = require("../utils/wrapAsync");

// Webhook — no auth, raw body needed
router.post("/webhook", express.raw({ type: "application/json" }), wrapAsync(ctrl.refundWebhook));

// My bookings list
router.get("/my",   isLoggedIn, wrapAsync(ctrl.myBookings));

// Single booking detail
router.get("/:id",  isLoggedIn, wrapAsync(ctrl.bookingDetail));

// Cancel preview — show refund policy before confirming
router.get("/:id/cancel-preview", isLoggedIn, wrapAsync(ctrl.cancelPreview));

// Execute cancellation + refund
router.post("/:id/cancel", isLoggedIn, wrapAsync(ctrl.cancelBooking));

// Host marks listing unavailable → auto full refund
router.post("/:id/unavailable", isLoggedIn, wrapAsync(ctrl.markUnavailable));

// Admin manual refund
router.post("/:id/refund", isLoggedIn, isAdmin, wrapAsync(ctrl.adminRefund));

// Fallback
router.post("/", isLoggedIn, wrapAsync(ctrl.createBooking));

module.exports = router;
