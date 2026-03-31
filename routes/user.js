const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const userController = require("../controllers/users.js"); // Adjust path
const { saveRedirectUrl } = require("../middlewares/authenticate.js");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const User = require("../models/user"); // 

// Signup
router.route("/signup")
    .get(userController.signupForm)
    .post(wrapAsync(userController.signup));

// Signin
router.route("/signin")
    .get(userController.signinForm)
    .post(
        // ✅ Remove saveRedirectUrl middleware
        passport.authenticate("local", {
            failureRedirect: "/user/signin",
            failureFlash: true,
        }),
        userController.signin
    );

// Logout
router.get("/logout", userController.logout);

router.get("/google", async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) {
            return res.redirect("/user/signin");
        }
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { email, name, picture, sub } = payload;

        let user = await User.findOne({ email });

        if (!user) {
            user = new User({
                email,
                username: name,
                googleId: sub,
                avatar: picture,
            });
            await user.save();
        } else if (!user.googleId) {
            user.googleId = sub;
            await user.save();
        }

        // 🔥 THIS PART IS KEY
        req.login(user, (err) => {
            if (err) {
                console.log(err);
                return res.redirect("/user/signin");
            }

            // ✅ Save session before redirect
            req.session.save((err) => {
                if (err) {
                    console.log(err);
                    return res.redirect("/user/signin");
                }

                // ✅ FINAL REDIRECT (user stays logged in)
                res.redirect("/listings");
            });
        });

    } catch (err) {
        console.log(err);
        res.redirect("/user/signin");
    }
});

module.exports = router;