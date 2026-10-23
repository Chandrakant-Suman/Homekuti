const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin");
const { isLoggedIn } = require("../middlewares/authenticate");
const { isAdmin } = require("../middlewares/authorize");
const wrapAsync = require("../utils/wrapAsync");
const { freshStatuses } = require("../utils/bookingLifecycle");

// Apply isAdmin to all admin routes
router.use(isLoggedIn, isAdmin);

router.get("/dashboard", freshStatuses, wrapAsync(adminController.dashboard));
router.get("/users", wrapAsync(adminController.listUsers));
router.post("/users/:id/role", wrapAsync(adminController.changeRole));
router.delete("/users/:id", wrapAsync(adminController.deleteUser));
router.post("/users/:id/delete-request/approve", wrapAsync(adminController.approveDeleteRequest));
router.post("/users/:id/delete-request/reject", wrapAsync(adminController.rejectDeleteRequest));
router.get("/listings", wrapAsync(adminController.listListings));
router.delete("/listings/:id", wrapAsync(adminController.deleteListing));
router.post("/listings/:id/verify", wrapAsync(adminController.verifyListing));
router.post("/listings/:id/reject", wrapAsync(adminController.rejectListing));
router.post("/listings/:id/revoke", wrapAsync(adminController.revokeVerification));
router.get("/bookings", freshStatuses, wrapAsync(adminController.listBookings));
router.delete("/reviews/:id", wrapAsync(adminController.deleteReview));

module.exports = router;
