const User = require("../models/user");
const { saveRedirectUrl } = require("../middlewares/authenicate");

module.exports.signinForm = (req, res) => {
    res.render("users/signin");
};

module.exports.signin = async (req, res) => {
    console.log("✓ User signed in:", req.user.username);
    console.log("✓ Session ID:", req.sessionID);
    console.log("✓ Is Authenticated:", req.isAuthenticated());
    req.flash("success", "Welcome back to Homekuti!");
    let redirectUrl = req.session.returnTo || "/listings";
    
    // Prevent bad redirects
    if (
        redirectUrl.includes("_method") ||
        redirectUrl.includes("/reviews") ||
        redirectUrl.includes("POST")
    ) {
        redirectUrl = "/listings";
    }
    delete req.session.returnTo;
    
    req.session.save((err) => {
        if (err) {
            console.error("Session save error:", err);
            return res.redirect("/user/signin");
        }
        res.redirect(redirectUrl);
    });
};

module.exports.signupForm = (req, res) => {
    res.render("users/signup");
};

module.exports.signup = async (req, res, next) => {
    try {
        const { email, username, password } = req.body;
        const newUser = new User({ email, username });
        const registeredUser = await User.register(newUser, password);

        // AUTO LOGIN HERE
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to Homekuti!");
            
            // ✅ FIX: Save session before redirect
            req.session.save((err) => {
                if (err) {
                    console.error("Session save error:", err);
                    return res.redirect("/user/signup");
                }
                res.redirect("/listings");
            });
        });

    } catch (err) {
        if (err.name === "UserExistsError") {
            req.flash("error", "Username already exists. Please try another one.");
            return res.redirect("/user/signup");
        }
        req.flash("error", "Something went wrong. Please try again.");
        res.redirect("/user/signup");
    }
};

module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash("success", "Logged you out successfully.");
        
        // ✅ FIX: Save session before redirect (to persist flash message)
        req.session.save((err) => {
            if (err) {
                console.error("Session save error:", err);
            }
            res.redirect("/");
        });
    });
};