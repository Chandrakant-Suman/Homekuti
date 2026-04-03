const User = require("../models/user");
const Booking = require("../models/booking");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

module.exports.signinForm = (req, res) => {
    res.render("users/signin");
};

module.exports.signin = async (req, res) => {
    console.log("✓ User signed in:", req.user.username);
    req.flash("success", `Welcome back, ${req.user.username}!`);
    let redirectUrl = req.session.returnTo || "/listings";
    if (redirectUrl.includes("_method") || redirectUrl.includes("/reviews") || redirectUrl.includes("POST")) {
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
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to Homekuti!");
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
        req.flash("success", "Logged out successfully.");
        req.session.save((err) => {
            if (err) console.error("Session save error:", err);
            res.redirect("/");
        });
    });
};

// Google OAuth via One Tap token
module.exports.googleAuth = async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            req.flash("error", "Google login failed. Please try again.");
            return res.redirect("/user/signin");
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        // Find or create user
        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        if (!user) {
            // Generate a unique username from email
            let baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
            let username = baseUsername;
            let counter = 1;
            while (await User.findOne({ username })) {
                username = `${baseUsername}${counter++}`;
            }
            user = new User({ username, email, googleId, avatar: picture });
            await user.save();
        } else if (!user.googleId) {
            user.googleId = googleId;
            user.avatar = user.avatar || picture;
            await user.save();
        }

        req.login(user, (err) => {
            if (err) {
                req.flash("error", "Login failed. Please try again.");
                return res.redirect("/user/signin");
            }
            req.flash("success", `Welcome, ${user.username}!`);
            req.session.save(() => res.redirect("/listings"));
        });
    } catch (err) {
        console.error("Google auth error:", err);
        req.flash("error", "Google login failed. Please try again.");
        res.redirect("/user/signin");
    }
};

module.exports.profile = async (req, res) => {
    const user = await User.findById(req.user._id)
        .populate("wishlist")
        .populate("bookings");
    res.render("users/profile", { user });
};

module.exports.toggleWishlist = async (req, res) => {
    const { listingId } = req.params;
    const user = await User.findById(req.user._id);
    const idx = user.wishlist.findIndex(id => id.toString() === listingId);
    if (idx === -1) {
        user.wishlist.push(listingId);
    } else {
        user.wishlist.splice(idx, 1);
    }
    await user.save();
    res.json({ success: true, wishlisted: idx === -1 });
};

module.exports.myBookings = async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
        .populate("listing")
        .sort({ createdAt: -1 });
    res.render("bookings/my-bookings", { bookings });
};
