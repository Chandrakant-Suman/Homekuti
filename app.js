// ================= CORE SETUP =================

const express = require("express");
const app = express();

const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");

// ================= MODELS =================
// Central data layer (MongoDB schemas)
const Listing = require("./models/listing");
const User = require("./models/user.js");

// ================= ROUTES =================
// Modular route handlers (keeps app.js clean)
const listingRouter = require("./routes/listing.js");
const reviewsRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

// ================= UTILITIES & MIDDLEWARE =================
// Reusable helpers and custom middleware

const maintenance = require("./middlewares/maintenance");
const wrapAsync = require("./utils/wrapAsync");
const ExpressError = require("./utils/ExpressError");

// ================= DATABASE CONNECTION =================
// Single connection to MongoDB (singleton pattern)

const MONGO_URL = "mongodb://127.0.0.1:27017/Homekuti";

mongoose
   .connect(MONGO_URL)
   .then(() => console.log("Connected to MongoDB"))
   .catch((err) => console.log("Mongo Error:", err));

// ================= VIEW ENGINE =================
// ejs-mate enables layouts & partials (boilerplate system)

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ================= GLOBAL MIDDLEWARE =================
// These run on every request

app.use(express.static(path.join(__dirname, "public"))); // Serve static files (CSS, JS, Images)
app.use(express.urlencoded({ extended: true })); // Parse form data (application/x-www-form-urlencoded)
app.use(express.json()); // Parse JSON payloads (API support)
app.use(methodOverride("_method")); // Enable PUT/DELETE via ?_method=DELETE

// ================= SESSION CONFIG =================
// Session must be configured BEFORE use
// ⚠️ In production, store secret in environment variables

const sessionOptions = {
    secret: "homekuti_super_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        // secure: true, // Enable only with HTTPS
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true, // Prevent XSS cookie theft
    }
};

// Parse cookies before session
app.use(cookieParser());

// ================= SESSION & FLASH =================
// Order matters here: cookie → session → flash

app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ================= GLOBAL TEMPLATE VARIABLES =================
// Variables accessible in every EJS file

app.use((req, res, next) => {
   res.locals.activeRoute = req.path; // For navbar highlighting
   res.locals.user = req.user || null; // For future authentication
   res.locals.currUser = req.user; // Current logged-in user
   next();
});

// Make flash messages globally available in EJS
// This avoids passing success/error manually in every render

app.use((req, res, next) => {
   res.locals.success = req.flash("success");
   res.locals.error = req.flash("error");
   next();
});


// ================= ROUTE SETUP =================

// HOME PAGE (Landing Page)
app.get(
   "/",
   maintenance, // Blocks site if maintenance mode is ON
   wrapAsync(async (req, res) => {

      // Random featured listings
      const featuredListings = await Listing.aggregate([
         { $sample: { size: 3 } },
      ]);

      res.render("home", { featuredListings });
   }),
);

// LISTING ROUTES (CRUD Operations)
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/user", userRouter);

// ================= API ENDPOINT =================
// Public JSON API (useful for mobile / frontend clients)

app.get(
   "/api/listings",
   wrapAsync(async (req, res) => {
      const listings = await Listing.find({});
      res.json(listings);
   }),
);

// ================= STATIC PAGES =================
// Informational pages

app.get("/about", (req, res) => res.render("about"));
app.get("/contact", (req, res) => res.render("contact"));
app.get("/terms", (req, res) => res.render("terms"));
app.get("/privacy", (req, res) => res.render("privacy"));
app.get("/maintenance", (req, res) => res.render("maintenance"));

// ================= ERROR HANDLING =================

// 404 Handler (Must be after all routes)
app.use((req, res, next) => {
   next(new ExpressError(404, "Page Not Found"));
});

// Centralized Error Handler
// All thrown errors land here

app.use((err, req, res, next) => {
   const { statusCode = 500 } = err;

   // Fallback for unknown errors
   if (!err.message) err.message = "Something went wrong";

   res.status(statusCode).render("error", { err });
});

// ================= SERVER BOOTSTRAP =================

const PORT = process.env.PORT || 8000;

// Start HTTP server
app.listen(PORT, () => {
   console.log(`Server running on port ${PORT}`);
});
