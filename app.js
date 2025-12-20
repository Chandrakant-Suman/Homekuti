// app.js
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError");
const wrapAsync = require("./utils/wrapAsync.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/Homekuti";

// -----------------------
// DATABASE
// -----------------------
main()
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.log("Mongo Error:", err));

async function main() {
  await mongoose.connect(MONGO_URL);
}

// -----------------------
// VIEW ENGINE
// -----------------------
app.engine("ejs", ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// -----------------------
// MIDDLEWARE
// -----------------------
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

app.use((req, res, next) => {
  res.locals.activeRoute = req.path;
  res.locals.user = req.user || null;
  next();
});

// -----------------------
// ROUTES
// -----------------------

// HOME
app.get("/", wrapAsync(async (req, res) => {
  const featuredListings = await Listing.aggregate([{ $sample: { size: 3 } }]);
  res.render("home", { featuredListings });
}));

// INDEX
app.get("/listings", wrapAsync(async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index", { allListings });
}));

// NEW
app.get("/listings/new", (req, res) => {
  res.render("listings/new");
});

// CREATE
app.post("/listings", wrapAsync(async (req, res) => {
  if (!req.body.listing) {
    throw new ExpressError(400, "Send valid data for listing.");
  }
  const newListing = new Listing(req.body.listing);
  await newListing.save();
  res.redirect(`/listings/${newListing._id}`);
}));

// SHOW
app.get("/listings/:id", wrapAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new ExpressError(404, "Listing not found");
  }

  const listing = await Listing.findById(id);
  if (!listing) {
    throw new ExpressError(404, "Listing not found");
  }

  res.render("listings/show", { listing });
}));

// EDIT
app.get("/listings/:id/edit", wrapAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new ExpressError(404, "Listing not found");
  }

  const listing = await Listing.findById(id);
  if (!listing) {
    throw new ExpressError(404, "Listing not found");
  }

  res.render("listings/edit", { listing });
}));

// UPDATE
app.put("/listings/:id", wrapAsync(async (req, res) => {
  const { id } = req.params;

  const listing = await Listing.findByIdAndUpdate(
    id,
    req.body.listing,
    { runValidators: true, new: true }
  );

  if (!listing) {
    throw new ExpressError(404, "Listing not found");
  }

  res.redirect(`/listings/${id}`);
}));

// DELETE
app.delete("/listings/:id", wrapAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new ExpressError(404, "Listing not found");
  }

  await Listing.findByIdAndDelete(id);
  res.redirect("/listings");
}));

// STATIC PAGES
app.get("/about", (req, res) => res.render("about"));
app.get("/contact", (req, res) => res.render("contact"));
app.get("/terms", (req, res) => res.render("terms"));
app.get("/privacy", (req, res) => res.render("privacy"));

// -----------------------
// 404 CATCH-ALL
// -----------------------
app.use((req, res, next) => {
  next(new ExpressError(404, "404: Page Not Found"));
});

// -----------------------
// CENTRAL ERROR HANDLER
// -----------------------
app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong" } = err;
  res.render("error.ejs",{err});
  // res.status(statusCode).send(message);
});

// -----------------------
// SERVER
// -----------------------
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
