const User = require("../models/user");
const Booking = require("../models/booking");
const crypto = require("crypto");
const passport = require("passport");
const { OAuth2Client } = require("google-auth-library");
const { sendMail } = require("../utils/mailer");
const { isProtectedAdmin } = require("../utils/protectedAdmin");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

module.exports.signinForm = (req, res) => {
    res.render("users/signin");
};

// Local login with an explicit failure path: set the flash and wait for the
// session store to persist it before redirecting, so the message always shows.
module.exports.authenticateLocal = (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            const message = info?.message === "Missing credentials"
                ? "Please enter your username/email and password."
                : info?.message || "Password or username is incorrect";
            req.flash("error", message);
            return req.session.save((saveErr) => {
                if (saveErr) console.error("Session save error:", saveErr);
                res.redirect("/user/signin");
            });
        }
        // Keep returnTo across login (passport 0.6+ regenerates the session)
        const returnTo = req.session.returnTo;
        req.logIn(user, (loginErr) => {
            if (loginErr) return next(loginErr);
            if (returnTo) req.session.returnTo = returnTo;
            next();
        });
    })(req, res, next);
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
        .select("+hash")
        .populate("wishlist")
        .populate("bookings");
    // Google-only accounts have no local password yet
    const hasPassword = Boolean(user.hash);
    res.render("users/profile", { user, hasPassword });
};

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;
const MIN_PASSWORD_LENGTH = 8;

module.exports.updateUsername = async (req, res) => {
    const username = (req.body.username || "").trim();

    if (!USERNAME_RE.test(username)) {
        req.flash("error", "Username must be 3-30 characters: letters, numbers, dots or underscores.");
        return res.redirect("/user/profile");
    }
    if (username === req.user.username) {
        req.flash("error", "That is already your username.");
        return res.redirect("/user/profile");
    }

    // Case-insensitive check so "Alice" and "alice" can't coexist
    const taken = await User.findOne({ username, _id: { $ne: req.user._id } })
        .collation({ locale: "en", strength: 2 });
    if (taken) {
        req.flash("error", "That username is already taken.");
        return res.redirect("/user/profile");
    }

    await User.findByIdAndUpdate(req.user._id, { username }, { runValidators: true });
    req.flash("success", "Username updated.");
    res.redirect("/user/profile");
};

module.exports.updatePassword = async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
        req.flash("error", `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return res.redirect("/user/profile");
    }
    if (newPassword !== confirmPassword) {
        req.flash("error", "New password and confirmation do not match.");
        return res.redirect("/user/profile");
    }

    const user = await User.findById(req.user._id).select("+hash +salt");
    const hadPassword = Boolean(user.hash);

    try {
        if (hadPassword) {
            if (!currentPassword) {
                req.flash("error", "Please enter your current password.");
                return res.redirect("/user/profile");
            }
            if (currentPassword === newPassword) {
                req.flash("error", "New password must be different from the current one.");
                return res.redirect("/user/profile");
            }
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.changePassword(currentPassword, newPassword);
        } else {
            // Google-only account setting a password for the first time
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            await user.setPassword(newPassword);
            await user.save();
        }
    } catch (err) {
        if (err.name === "IncorrectPasswordError") {
            req.flash("error", "Current password is incorrect.");
        } else {
            console.error("Password update error:", err);
            req.flash("error", "Could not update password. Please try again.");
        }
        return res.redirect("/user/profile");
    }

    req.flash("success", hadPassword ? "Password updated." : "Password set.");
    res.redirect("/user/profile");
};

module.exports.requestDeletion = async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user.role === "admin" || isProtectedAdmin(user)) {
        req.flash("error", "Admin accounts cannot request deletion. Ask another admin to change your role first.");
        return res.redirect("/user/profile");
    }
    if (user.deleteRequest?.status === "pending") {
        req.flash("error", "You already have a pending deletion request.");
        return res.redirect("/user/profile");
    }

    user.deleteRequest = {
        status: "pending",
        reason: (req.body.reason || "").trim().slice(0, 500),
        requestedAt: new Date(),
    };
    await user.save();

    req.flash("success", "Deletion request sent. An admin will review it shortly.");
    res.redirect("/user/profile");
};

module.exports.cancelDeletionRequest = async (req, res) => {
    await User.updateOne(
        { _id: req.user._id, "deleteRequest.status": "pending" },
        { $set: { "deleteRequest.status": "none", "deleteRequest.reviewedAt": new Date() } }
    );
    req.flash("success", "Deletion request cancelled.");
    res.redirect("/user/profile");
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

// ================= FORGOT / RESET PASSWORD =================
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;   // link valid for 30 minutes
const RESET_RESEND_COOLDOWN_MS = 60 * 1000;  // at most one email per minute
const escapeHtml = str => String(str).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hashToken = token => crypto.createHash("sha256").update(token).digest("hex");

module.exports.forgotPasswordForm = (req, res) => {
    res.render("users/forgot-password");
};

module.exports.forgotPassword = async (req, res) => {
    const email = (req.body.email || "").trim();
    // Same response whether or not the email exists, so accounts can't be probed
    const genericMsg = "If an account exists for that email, a password reset link has been sent.";

    if (!email) {
        req.flash("error", "Please enter your email address.");
        return res.redirect("/user/forgot-password");
    }

    const user = await User.findOne({ email }).collation({ locale: "en", strength: 2 });
    const recentlySent = user?.resetPasswordRequestedAt &&
        Date.now() - user.resetPasswordRequestedAt.getTime() < RESET_RESEND_COOLDOWN_MS;

    if (user && !recentlySent) {
        const token = crypto.randomBytes(32).toString("hex");
        user.resetPasswordToken = hashToken(token);
        user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
        user.resetPasswordRequestedAt = new Date();
        await user.save();

        const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
        const link = `${baseUrl}/user/reset-password/${token}`;
        try {
            await sendMail({
                to: user.email,
                subject: "Reset your Homekuti password",
                text: `Hi ${user.username},

We received a request to reset the password for your account (username: ${user.username}). Open this link within 30 minutes to choose a new one:

${link}

If you didn't request this, you can ignore this email.`,
                html: `<p>Hi ${escapeHtml(user.username)},</p>
                    <p>We received a request to reset the password for your account (username: <strong>${escapeHtml(user.username)}</strong>). Click the button below within 30 minutes to choose a new one.</p>
                    <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#fe424d;color:#fff;border-radius:8px;text-decoration:none;">Reset password</a></p>
                    <p style="color:#6b7280;font-size:13px;">Or paste this link into your browser:<br>${link}</p>
                    <p style="color:#6b7280;font-size:13px;">If you didn't request this, you can ignore this email.</p>`,
            });
        } catch (err) {
            console.error("Reset email error:", err);
            req.flash("error", "Could not send the reset email right now. Please try again later.");
            return res.redirect("/user/forgot-password");
        }
    }

    req.flash("success", genericMsg);
    res.redirect("/user/signin");
};

const findUserByResetToken = token =>
    User.findOne({
        resetPasswordToken: hashToken(token || ""),
        resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordToken +hash +salt");

module.exports.resetPasswordForm = async (req, res) => {
    const user = await findUserByResetToken(req.params.token);
    if (!user) {
        req.flash("error", "This reset link is invalid or has expired. Please request a new one.");
        return res.redirect("/user/forgot-password");
    }
    res.render("users/reset-password", { token: req.params.token });
};

module.exports.resetPassword = async (req, res) => {
    const { token } = req.params;
    const { newPassword, confirmPassword } = req.body;

    const user = await findUserByResetToken(token);
    if (!user) {
        req.flash("error", "This reset link is invalid or has expired. Please request a new one.");
        return res.redirect("/user/forgot-password");
    }
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
        req.flash("error", `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return res.redirect(`/user/reset-password/${token}`);
    }
    if (newPassword !== confirmPassword) {
        req.flash("error", "Passwords do not match.");
        return res.redirect(`/user/reset-password/${token}`);
    }

    await user.setPassword(newPassword);
    // Single-use: clear the token so the link can't be reused
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    req.flash("success", `Password reset. Sign in as "${user.username}" (or with your email) using your new password.`);
    res.redirect("/user/signin");
};
