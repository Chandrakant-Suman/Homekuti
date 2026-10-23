const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../controllers/users");
const { isLoggedIn } = require("../middlewares/authenticate");
const wrapAsync = require("../utils/wrapAsync");
const {
  signinLimiter, signupLimiter, forgotPasswordLimiter, passwordChangeLimiter, verifyEmailLimiter,
} = require("../middlewares/rateLimit");

// Signin
router.get("/signin", userController.signinForm);
router.post("/signin", signinLimiter, userController.authenticateLocal, userController.signin);

// Signup
router.get("/signup", userController.signupForm);
router.post("/signup", signupLimiter, wrapAsync(userController.signup));

// Forgot / reset password
router.get("/forgot-password", userController.forgotPasswordForm);
router.post("/forgot-password", forgotPasswordLimiter, wrapAsync(userController.forgotPassword));
router.get("/reset-password/:token", wrapAsync(userController.resetPasswordForm));
router.post("/reset-password/:token", passwordChangeLimiter, wrapAsync(userController.resetPassword));

// Email verification
router.get("/verify-email/:token", wrapAsync(userController.verifyEmail));
router.post("/verify-email/resend", isLoggedIn, verifyEmailLimiter, wrapAsync(userController.resendVerification));

// Logout
router.get("/logout", userController.logout);

// Google OAuth (token-based via Google One Tap)
router.get("/google", wrapAsync(userController.googleAuth));

// Profile
router.get("/profile", isLoggedIn, wrapAsync(userController.profile));
router.patch("/profile/username", isLoggedIn, wrapAsync(userController.updateUsername));
router.patch("/profile/password", isLoggedIn, passwordChangeLimiter, wrapAsync(userController.updatePassword));
router.post("/profile/delete-request", isLoggedIn, wrapAsync(userController.requestDeletion));
router.delete("/profile/delete-request", isLoggedIn, wrapAsync(userController.cancelDeletionRequest));

// Wishlist toggle
router.post("/wishlist/:listingId", isLoggedIn, wrapAsync(userController.toggleWishlist));

// My bookings
router.get("/bookings", isLoggedIn, wrapAsync(userController.myBookings));

module.exports = router;
