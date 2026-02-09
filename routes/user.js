const express = require("express");
const router = express.Router();
const passport = require("passport");
const wrapAsync = require("../utils/wrapAsync");

const { saveRedirectUrl } = require("../middlewares/authenicate");

const userController = require("../controllers/users");

// ================= SIGNIN =================
// Show login form
router.get("/signin", userController.signinForm);

// Handle login
router.post("/signin",
  passport.authenticate("local", {
    failureRedirect: "/signin",
    failureFlash: true
  }),
  userController.signin
);

// ================= SIGNUP =================
// Show register form
router.get("/signup", userController.signupForm);

// Handle register and auto login
router.post(
  "/signup",
  wrapAsync(userController.signup)
);

// ================= LOGOUT =================
router.get("/logout", userController.logout);

module.exports = router;
