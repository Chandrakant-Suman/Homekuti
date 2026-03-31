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