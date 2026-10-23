// Rate limits for abuse-prone endpoints (brute force, email flooding, date-hold spam).
// Counts are per IP (app sets "trust proxy" so Render's real client IP is used),
// or per user where the route requires login.
const { rateLimit } = require("express-rate-limit");

const MIN = 60 * 1000;

// Browser form posts: flash a message and send the user back to the form
const formHandler = redirectTo => (req, res, next, options) => {
  const minutes = Math.ceil(options.windowMs / MIN);
  req.flash("error", `Too many attempts. Please wait ${minutes} minutes and try again.`);
  req.session.save(() => res.redirect(typeof redirectTo === "function" ? redirectTo(req) : redirectTo));
};

const common = { standardHeaders: "draft-7", legacyHeaders: false };

module.exports.signinLimiter = rateLimit({
  ...common,
  windowMs: 15 * MIN,
  limit: 10,
  skipSuccessfulRequests: true, // only failed logins count
  // Both outcomes are 302 redirects, so "success" means a user is now logged in
  requestWasSuccessful: req => Boolean(req.user),
  handler: formHandler("/user/signin"),
});

module.exports.signupLimiter = rateLimit({
  ...common,
  windowMs: 60 * MIN,
  limit: 5,
  handler: formHandler("/user/signup"),
});

module.exports.forgotPasswordLimiter = rateLimit({
  ...common,
  windowMs: 60 * MIN,
  limit: 5,
  handler: formHandler("/user/forgot-password"),
});

module.exports.passwordChangeLimiter = rateLimit({
  ...common,
  windowMs: 15 * MIN,
  limit: 10,
  keyGenerator: (req, res) => (req.user ? `user:${req.user._id}` : req.ip),
  handler: formHandler(req => (req.user ? "/user/profile" : req.originalUrl)),
});

// Each checkout places a date hold; cap it so one account can't block many listings
module.exports.checkoutLimiter = rateLimit({
  ...common,
  windowMs: 15 * MIN,
  limit: 15,
  keyGenerator: req => `user:${req.user._id}`,
  handler: (req, res) => res.status(429).json({
    success: false,
    message: "Too many checkout attempts. Please wait a few minutes and try again.",
  }),
});
