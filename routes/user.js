const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/users");
const { isLoggedIn } = require("../middlewares/authenicate");
const wrapAsync = require("../utils/wrapAsync");

// Signin
router.get("/signin", userController.signinForm);
router.post(
  "/signin",
  passport.authenticate("local", {
    failureFlash: true,
    failureRedirect: "/user/signin",
  }),
  userController.signin
);

// Signup
router.get("/signup", userController.signupForm);
router.post("/signup", wrapAsync(userController.signup));

// Logout
router.get("/logout", userController.logout);

// Google OAuth (token-based via Google One Tap)
router.get("/google", wrapAsync(userController.googleAuth));

// Profile
router.get("/profile", isLoggedIn, wrapAsync(userController.profile));

// Wishlist toggle
router.post("/wishlist/:listingId", isLoggedIn, wrapAsync(userController.toggleWishlist));

// My bookings
router.get("/bookings", isLoggedIn, wrapAsync(userController.myBookings));

module.exports = router;
