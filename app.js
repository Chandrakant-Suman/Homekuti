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
const dbUrl = process.env.ATLASDB_URL;

mongoose
  .connect(dbUrl)
  .then(() => console.log("✓ Connected to MongoDB Atlas"))
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

mongoose.connection.on("connected", () => {
  console.log("✓ MongoDB reconnected");
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
// In v6, the actual MongoStore class is at .default
const MongoStore = require("connect-mongo").default;

const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: {
    secret: process.env.SESSION_SECRET,
  },
  touchAfter: 24 * 3600, // Lazy session update (24 hours)
  collectionName: "sessions", // Explicitly set collection name
});

// Session store event handlers
store.on("error", (err) => {
  console.error("❌ SESSION STORE ERROR:", err);
});

store.on("create", (sessionId) => {
  console.log("✓ Session created in MongoDB:", sessionId);
});

store.on("touch", (sessionId) => {
  console.log("✓ Session touched:", sessionId);
});

store.on("update", (sessionId) => {
  console.log("✓ Session updated:", sessionId);
});

store.on("destroy", (sessionId) => {
  console.log("✓ Session destroyed:", sessionId);
});

const sessionOptions = {
  name: "homekuti.sid",
  store,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // Extends session on activity
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    sameSite: "lax",
    secure: false, // ✅ MUST be false for localhost development
    path: "/",
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

// ================= DEBUG MIDDLEWARE (REMOVE IN PRODUCTION) =================
// app.use((req, res, next) => {
//   console.log("\n--- Request Debug ---");
//   console.log("Path:", req.path);
//   console.log("Method:", req.method);
//   console.log("Session ID:", req.sessionID);
//   console.log("Has Session:", !!req.session);
//   console.log("Authenticated:", req.isAuthenticated());
//   console.log("User:", req.user ? req.user.username : "No user");
//   console.log("Cookie Header:", req.headers.cookie ? "Present" : "Missing");
//   console.log("-------------------\n");
//   next();
// });

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

// ================= TEST ROUTES (REMOVE IN PRODUCTION) =================
app.get("/test/auth", (req, res) => {
  res.json({
    isAuthenticated: req.isAuthenticated(),
    sessionID: req.sessionID,
    user: req.user,
    session: req.session,
    cookie: req.headers.cookie,
  });
});

app.get("/test/session", (req, res) => {
  if (!req.session.views) {
    req.session.views = 1;
  } else {
    req.session.views++;
  }

  req.session.save((err) => {
    if (err) {
      return res.json({ error: err.message });
    }
    res.json({
      message: "Session test - refresh to see views increment",
      views: req.session.views,
      sessionID: req.sessionID,
      saved: true,
    });
  });
});

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
  console.log(`✓ Database: ${dbUrl.includes("127.0.0.1") ? "Local" : "Remote"}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    mongoose.connection.close(false, () => {
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  });
});

// Export for testing
module.exports = app;