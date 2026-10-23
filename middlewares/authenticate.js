module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    if (req.method === "GET") {
      req.session.returnTo = req.originalUrl;
    }

    req.flash("error", "Please login to continue");
    return res.redirect("/user/signin");
  }

  // ensure user is attached
  if (!req.user) {
    req.flash("error", "Session expired. Please login again.");
    return res.redirect("/user/signin");
  }

  next();
};
// Booking and hosting need a confirmed email (contact for the stay / payouts).
// Accounts created before email verification existed are treated as verified.
const { isEmailVerified } = require("../utils/accountRules");

module.exports.requireVerifiedEmail = (req, res, next) => {
  if (isEmailVerified(req.user)) return next();
  const message = "Please verify your email first — check your inbox or use \"Resend link\".";
  if (req.is("application/json") || req.xhr) {   // fetch() calls such as create-order
    return res.status(403).json({ success: false, message });
  }
  req.flash("error", message);
  req.session.save(() => res.redirect("/user/profile"));
};
