const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/booking");
const { isLoggedIn } = require("../middlewares/authenticate");
const { isAdmin }    = require("../middlewares/authorize");
const wrapAsync      = require("../utils/wrapAsync");
const { freshStatuses } = require("../utils/bookingLifecycle");

// Webhook — no auth, raw body needed
// NOTE: signature verification needs the raw bytes;
router.post("/webhook", wrapAsync(ctrl.refundWebhook));

// My bookings list
router.get("/my",   isLoggedIn, freshStatuses, wrapAsync(ctrl.myBookings));

// Single booking detail
router.get("/:id",  isLoggedIn, freshStatuses, wrapAsync(ctrl.bookingDetail));

// Cancel preview — show refund policy before confirming
router.get("/:id/cancel-preview", isLoggedIn, freshStatuses, wrapAsync(ctrl.cancelPreview));

// Execute cancellation + refund
router.post("/:id/cancel", isLoggedIn, freshStatuses, wrapAsync(ctrl.cancelBooking));

// Host marks listing unavailable → auto full refund
router.post("/:id/unavailable", isLoggedIn, wrapAsync(ctrl.markUnavailable));

// Admin manual refund
router.post("/:id/refund", isLoggedIn, isAdmin, wrapAsync(ctrl.adminRefund));
router.post("/:id/refund/cancel", isLoggedIn, isAdmin, wrapAsync(ctrl.cancelRefund));
router.post("/:id/refund/sync", isLoggedIn, isAdmin, wrapAsync(ctrl.syncRefund));

// Fallback
router.post("/", isLoggedIn, wrapAsync(ctrl.createBooking));
module.exports = router;
