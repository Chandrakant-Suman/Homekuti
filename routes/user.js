const express = require("express");
const router = express.Router();

const passport = require("passport");
const wrapAsync = require("../utils/wrapAsync");
const User = require("../models/user");


// ================= SIGNIN =================

// Show login form
router.get("/signin", (req, res) => {
    res.render("users/signin");
});


// Handle login
router.post(
    "/signin",
    passport.authenticate("local", {
        failureRedirect: "/user/signin",
        failureFlash: true // Enable flash messages on failure
    }),
    (req, res) => { // Custom callback to add flash on success
        req.flash("success", "Welcome back to Homekuti!");
        res.redirect("/");
    }
);


// ================= SIGNUP =================

// Show register form
router.get("/signup", (req, res) => {
    res.render("users/signup");
});

// Handle register
router.post(
  "/signup",
  wrapAsync(async (req, res) => {
    try {
      const { email, username, password } = req.body;
      const newUser = new User({ email, username });
      const registeredUser = await User.register(newUser, password);
      console.log(registeredUser);
      req.flash("success", "Welcome to Homekuti!");
      res.redirect("/");
    } catch (err) {
      // If username already exists
      if (err.name === "UserExistsError") {
        req.flash("error", "Username already exists. Please try another one.");
        return res.redirect("/user/signup");
      }
      // Other errors
      req.flash("error", "Something went wrong. Please try again.");
      return res.redirect("/user/signup");
    }
  })
);


// ================= LOGOUT =================

router.get("/logout", (req, res, next) => {
    req.logout( (err)=> {
        if (err) return next(err);
        req.flash("success", "Logged you out successfully.");
        res.redirect("/");
    });
});


module.exports = router;
