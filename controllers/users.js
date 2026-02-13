const User = require("../models/user");
const { saveRedirectUrl } = require("../middlewares/authenicate");

module.exports.signinForm = (req, res) => {
    res.render("users/signin");
};
module.exports.signin = async (req, res) => {
    req.flash("success", "Welcome back to Homekuti!");
    let redirectUrl = req.session.returnTo || "/listings";
    // Prevent bad redirects (forms / _method routes)
    if (
        redirectUrl.includes("_method") ||
        redirectUrl.includes("/reviews") ||
        redirectUrl.includes("POST")
    ) {
        redirectUrl = "/listings";
    }
    delete req.session.returnTo;
    res.redirect(redirectUrl);
};
module.exports.signupForm = (req, res) => {
    res.render("users/signup");
};
module.exports.signup = async (req, res, next) => {
    try {
        const { email, username, password } = req.body;
        const newUser = new User({ email, username });
        const registeredUser = await User.register(newUser, password);
        // console.log(registeredUser);

        // AUTO LOGIN HERE
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to Homekuti!");
            res.redirect("/");
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
    req.logout( (err)=> {
        if (err) return next(err);
        req.flash("success", "Logged you out successfully.");
        res.redirect("/");
    });
};