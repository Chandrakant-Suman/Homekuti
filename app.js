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
const adminRoutes = require("./routes/admin");
const bookingRouter=require("./routes/booking")
const paymentRoutes=require("./routes/payment");

// ================= UTILITIES =================
const maintenance = require("./middlewares/maintenance");
const wrapAsync = require("./utils/wrapAsync");
const ExpressError = require("./utils/ExpressError");

// ================= ERROR HANDLING =================
const {
  handleMongooseError,
  handleMulterError,
  notFoundHandler,
  finalErrorHandler,
  setupProcessHandlers,
} = require("./utils/errorHandler");

// Setup process-level error handlers
setupProcessHandlers();

// ================= DATABASE CONNECTION =================
const dbUrl = process.env.ATLASDB_URL || process.env.MONGO_URI;

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
  require("./utils/protectedAdmin").ensureProtectedAdmin(User)
    .catch(err => console.error("Protected admin check failed:", err.message));
  console.log("✓ MongoDB reconnected");
});

// ================= VIEW ENGINE =================
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ================= GLOBAL MIDDLEWARE =================
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json({
  // Keep the exact bytes for the Razorpay webhook: its signature is computed
  // over the raw body, and re-serialising parsed JSON can change it
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith("/bookings/webhook")) req.rawBody = buf;
  },
})); // For API requests
// Express 5 leaves req.body undefined when a request has no parsable body;
// handlers here (written for Express 4) expect an object
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});
app.use(methodOverride("_method"));

// ================= HEALTH CHECK =================
// Used by CI/CD and uptime monitors. Registered before sessions/maintenance so
// it never creates a session and still answers during maintenance mode.
app.get("/healthz", (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? "ok" : "degraded",
    db: dbUp ? "up" : "down",
    commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
    uptime: Math.round(process.uptime()),
  });
});

// ================= SESSION CONFIG =================

// Trust proxy for production deployments
app.set("trust proxy", 1);

const isProduction = process.env.NODE_ENV === "production";
const isHttps = (process.env.BASE_URL || "").startsWith("https://");
const explicitSecure = process.env.SESSION_COOKIE_SECURE;
const isSecureCookie = explicitSecure === undefined
  ? (isProduction && isHttps)
  : explicitSecure === "true";
const explicitSameSite = process.env.SESSION_COOKIE_SAMESITE;
const sameSiteValue = explicitSameSite || (isSecureCookie ? "none" : "lax");

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
    sameSite: sameSiteValue,
    secure: isSecureCookie,
    path: "/",
  },
};

// Cookie parser BEFORE session
app.use(cookieParser());

// Session + Flash
app.use(session(sessionOptions));
app.locals.sessionStore = store;   // lets tests close the store's DB connection
app.use(flash());

// ================= PASSPORT AUTH =================
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser((user, done) => {
  done(null, user._id); // ✅ use ID
});
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// ================= GLOBAL TEMPLATE VARIABLES =================
app.use((req, res, next) => {
  res.locals.activeRoute = req.path;
  res.locals.currUser = req.user;
  res.locals.emailUnverified = Boolean(req.user) && req.user.emailVerified === false;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});


// ================= ROUTES =================

// HOME PAGE
app.get(
  "/",
  maintenance,
  wrapAsync(async (req, res) => {
  const featuredListings = await Listing.find({}).limit(3);

  const genres = (await Listing.distinct("genre")).filter(Boolean);

  // ⭐ Get highest rated listing
  const bestDealArr = await Listing.find({ avgRating: { $gt: 0 } })
    .sort({ avgRating: -1 })
    .limit(1)
    .lean();

  const bestDeal = bestDealArr[0] || null;

  res.render("home", {
    featuredListings,
    genres,
    activeGenre: "",
    bestDeal
  });
  })
);

// LISTING ROUTES
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/user", userRouter);
app.use("/admin", adminRoutes);
app.use("/bookings", bookingRouter);
app.use("/api/payment", paymentRoutes);

// STATIC PAGES
app.get("/about", (req, res) => res.render("about"));
app.get("/contact", (req, res) => res.render("contact"));
app.get("/terms", (req, res) => res.render("terms"));
app.get("/privacy", (req, res) => res.render("privacy"));
app.get("/maintenance", (req, res) => res.render("maintenance"));

// ================= TEST ROUTES (REMOVE IN PRODUCTION) =================
// ================= ERROR HANDLING =================

// 1. Transform Mongoose/MongoDB errors
app.use(handleMongooseError);

// 2. Transform Multer file upload errors
app.use(handleMulterError);


// 4. 404 Handler (must be AFTER all routes)
app.use(notFoundHandler);

// 5. Final error handler (sends response)
app.use(finalErrorHandler);

// ================= SERVER =================
const PORT = process.env.PORT || 8000;

// Start the server only when run directly (`node app.js`). Tests import the
// app without opening a port or starting timers.
if (require.main === module) {
  // Advance booking statuses (upcoming → active → completed) while the app is awake
  require("./utils/bookingLifecycle").startStatusScheduler();

  const server = app.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`✓ Database: ${dbUrl.includes("127.0.0.1") ? "Local" : "Remote"}`);
  });

  // Graceful shutdown (Render sends SIGTERM on every deploy)
  const shutdown = signal => {
    console.log(`${signal} received: closing HTTP server`);
    setTimeout(() => {
      console.error("Forced shutdown after 10s");
      process.exit(1);
    }, 10000).unref();
    server.close(async () => {
      console.log("HTTP server closed");
      await mongoose.connection.close();   // Mongoose 8: promise, no callback
      console.log("MongoDB connection closed");
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

module.exports = app;
