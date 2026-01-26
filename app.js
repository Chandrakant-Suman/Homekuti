const express = require("express");
const app = express();

const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");

// Models
const Listing = require("./models/listing");

// Routes
const listings = require("./routes/listing.js");
const reviews = require("./routes/review.js");

// Middlewares & Utils
const maintenance = require("./middlewares/maintenance");
const wrapAsync = require("./utils/wrapAsync");
const ExpressError = require("./utils/ExpressError");

// ================= DATABASE =================

const MONGO_URL = "mongodb://127.0.0.1:27017/Homekuti";

mongoose
   .connect(MONGO_URL)
   .then(() => console.log("Connected to MongoDB"))
   .catch((err) => console.log("Mongo Error:", err));

// ================= VIEW ENGINE =================

app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ================= GLOBAL MIDDLEWARE =================

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

// Local variables for EJS
app.use((req, res, next) => {
   res.locals.activeRoute = req.path;
   res.locals.user = req.user || null;
   next();
});

// ================= ROUTES =================

// HOME PAGE
app.get(
   "/",
   maintenance,
   wrapAsync(async (req, res) => {
      const featuredListings = await Listing.aggregate([
         { $sample: { size: 3 } },
      ]);

      res.render("home", { featuredListings });
   }),
);

// LISTING ROUTES
app.use("/listings", listings);
app.use("/listings/:id/reviews", reviews);

// API - ALL LISTINGS
app.get(
   "/api/listings",
   wrapAsync(async (req, res) => {
      const listings = await Listing.find({});
      res.json(listings);
   }),
);

// STATIC PAGES
app.get("/about", (req, res) => res.render("about"));
app.get("/contact", (req, res) => res.render("contact"));
app.get("/terms", (req, res) => res.render("terms"));
app.get("/privacy", (req, res) => res.render("privacy"));
app.get("/maintenance", (req, res) => res.render("maintenance"));

// ================= ERROR HANDLING =================

// 404
app.use((req, res, next) => {
   next(new ExpressError(404, "Page Not Found"));
});

// CENTRAL ERROR HANDLER
app.use((err, req, res, next) => {
   const { statusCode = 500 } = err;
   if (!err.message) err.message = "Something went wrong";
   res.status(statusCode).render("error", { err });
});

// ================= SERVER =================

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
   console.log(`Server running on port ${PORT}`);
});
