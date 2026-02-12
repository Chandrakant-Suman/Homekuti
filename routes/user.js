const express = require("express");
const router = express.Router();
const passport = require("passport");
const wrapAsync = require("../utils/wrapAsync");

const { saveRedirectUrl } = require("../middlewares/authenicate");

const userController = require("../controllers/users");

// ================= SIGNIN =================

router.route("/signin")
.get(userController.signinForm)
.post(
  passport.authenticate("local", {
    failureRedirect: "/user/signin",
    failureFlash: true
  }),
  userController.signin
);


// ================= SIGNUP =================
// Show register form
router.route("/signup")
.get(userController.signupForm)
.post(
  wrapAsync(userController.signup)
);

// ================= LOGOUT =================
router.get("/logout", userController.logout);

module.exports = router;
