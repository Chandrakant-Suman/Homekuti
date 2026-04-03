const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin");
const { isLoggedIn } = require("../middlewares/authenicate");
const { isAdmin } = require("../middlewares/authorize");
const wrapAsync = require("../utils/wrapAsync");

// Apply isAdmin to all admin routes
router.use(isLoggedIn, isAdmin);

router.get("/dashboard", wrapAsync(adminController.dashboard));
router.get("/users", wrapAsync(adminController.listUsers));
router.post("/users/:id/role", wrapAsync(adminController.changeRole));
router.delete("/users/:id", wrapAsync(adminController.deleteUser));
router.get("/listings", wrapAsync(adminController.listListings));
router.delete("/listings/:id", wrapAsync(adminController.deleteListing));
router.get("/bookings", wrapAsync(adminController.listBookings));
router.delete("/reviews/:id", wrapAsync(adminController.deleteReview));

module.exports = router;
