const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const userController = require("../controllers/users.js"); // Adjust path
const { saveRedirectUrl } = require("../middlewares/authenicate");

// Signup
router.route("/signup")
    .get(userController.signupForm)
    .post(wrapAsync(userController.signup));

// Signin
router.route("/signin")
    .get(userController.signinForm)
    .post(
        // ✅ Remove saveRedirectUrl middleware
        passport.authenticate("local", {
            failureRedirect: "/user/signin",
            failureFlash: true,
        }),
        userController.signin
    );

// Logout
router.get("/logout", userController.logout);

module.exports = router;