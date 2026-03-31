module.exports.isLoggedIn = (req, res, next) => {
  try {
    // Not authenticated
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      // Save redirect URL only for GET requests
      if (req.method === "GET") {
        req.session.returnTo = req.originalUrl;
      }

      req.flash("error", "Please login to continue");
      return res.redirect("/user/signin");
    }

    // Edge case: session exists but user missing
    if (!req.user) {
      req.flash("error", "Session expired. Please login again.");
      return res.redirect("/user/signin");
    }

    // All good
    return next();
    
  } catch (err) {
    console.error("Auth middleware error:", err);
    req.flash("error", "Authentication error. Please login again.");
    return res.redirect("/user/signin");
  }
};