// ================= CORE SETUP =================
require("dotenv").config();

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
const Listing = require("./models/listing");
const User = require("./models/user");

// ================= ROUTES =================
const listingRouter = require("./routes/listing");
const reviewsRouter = require("./routes/review");
const userRouter = require("./routes/user");

// ================= UTILITIES =================
const maintenance = require("./middlewares/maintenance");
const wrapAsync = require("./utils/wrapAsync");
const ExpressError = require("./utils/ExpressError");

// ================= ERROR HANDLING =================
const {
  handleMongooseError,
  handleMulterError,
  handleAuthError,
  notFoundHandler,
  finalErrorHandler,
  setupProcessHandlers,
} = require("./utils/errorHandler");

// Setup process-level error handlers
setupProcessHandlers();

// ================= DATABASE CONNECTION =================
const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/Homekuti";

mongoose
  .connect(MONGO_URL)
  .then(() => console.log("✓ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1); // Exit if database connection fails
  });

// Monitor MongoDB connection after initial connection
mongoose.connection.on("error", (err) => {
  console.error("MongoDB runtime error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB disconnected");
});

// ================= VIEW ENGINE =================
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ================= GLOBAL MIDDLEWARE =================
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // For API requests
app.use(methodOverride("_method"));

// ================= SESSION CONFIG =================

// Trust proxy for production deployments
app.set("trust proxy", 1);

// MongoDB session store (connect-mongo v6)
const MongoStore = require("connect-mongo").default;

const store = MongoStore.create({
  mongoUrl: MONGO_URL,
  crypto: {
    secret: process.env.SESSION_SECRET || "fallback-secret-change-in-production",
  },
  touchAfter: 24 * 3600,
});

store.on("error", (e) => {
  console.error("SESSION STORE ERROR:", e);
});

const sessionOptions = {
  name: "homekuti.sid",
  store,
  secret: process.env.SESSION_SECRET || "fallback-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  rolling: true, // extends session on activity
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 3, // 3 hours
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  },
};

// Cookie parser BEFORE session
app.use(cookieParser());

// Session + Flash
app.use(session(sessionOptions));
app.use(flash());

// ================= PASSPORT AUTH =================
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ================= GLOBAL TEMPLATE VARIABLES =================
app.use((req, res, next) => {
  res.locals.activeRoute = req.path;
  res.locals.currUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.hideFlash = false;
  next();
});

// ================= ROUTES =================

// HOME PAGE
app.get(
  "/",
  maintenance,
  wrapAsync(async (req, res) => {
    const featuredListings = await Listing.aggregate([{ $sample: { size: 3 } }]);
    res.render("home", { featuredListings });
  })
);

// LISTING ROUTES
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/user", userRouter);

// STATIC PAGES
app.get("/about", (req, res) => res.render("about"));
app.get("/contact", (req, res) => res.render("contact"));
app.get("/terms", (req, res) => res.render("terms"));
app.get("/privacy", (req, res) => res.render("privacy"));
app.get("/maintenance", (req, res) => res.render("maintenance"));

// Add BEFORE error handlers (for testing only)
app.get("/test/validation", wrapAsync(async (req, res) => {
  const listing = new Listing({}); // Missing required fields
  await listing.save(); // Will trigger ValidationError
}));
// ================= ERROR HANDLING =================

// 1. Transform Mongoose/MongoDB errors
app.use(handleMongooseError);

// 2. Transform Multer file upload errors
app.use(handleMulterError);

// 3. Transform JWT/Authentication errors
app.use(handleAuthError);

// 4. 404 Handler (must be AFTER all routes)
app.use(notFoundHandler);

// 5. Final error handler (sends response)
app.use(finalErrorHandler);

// ================= SERVER =================
const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`✓ Database: ${MONGO_URL.includes("127.0.0.1") ? "Local" : "Remote"}`);
});

// Store server reference for graceful shutdown
// global.httpServer = server;

// Export for testing
module.exports = app;