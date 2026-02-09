module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {

    // Save only GET routes
    if (req.method === "GET") {
      req.session.returnTo = req.originalUrl;
    }

    req.flash("error", "You must be logged in first");
    return res.redirect("/user/signin");
  }
  next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl;
    }
    next();
};
