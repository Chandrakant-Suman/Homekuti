// app.js
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const Listing = require("./models/listing.js");
const path = require("path");
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');

const MONGO_URL = 'mongodb://127.0.0.1:27017/Homekuti';

main()
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log("Error connecting to MongoDB:", err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

// view engine + views
app.engine('ejs', ejsMate);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// static, body parsing, method override
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));

// global locals
app.use((req, res, next) => {
  res.locals.activeRoute = req.path;
  // If you later add authentication middleware that sets req.user, this keeps it available to templates.
  res.locals.user = req.user || null;
  next();
});

// -----------------------
// ROUTES
// -----------------------

// HOME PAGE → Fetch 3 RANDOM listings from DB
app.get("/", async (req, res) => {
  try {
    const featuredListings = await Listing.aggregate([{ $sample: { size: 3 } }]);
    res.render("home", { featuredListings });
  } catch (error) {
    console.error("Error fetching random listings:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Index Route - list all
app.get("/listings", async (req, res) => {
  try {
    const allListings = await Listing.find({});
    res.render("listings/index", { allListings });
  } catch (err) {
    console.error("Error fetching listings:", err);
    res.status(500).send("Internal Server Error");
  }
});

// New Route - show create form
app.get("/listings/new", (req, res) => {
  res.render("listings/new");
});

// Create Route
app.post("/listings", async (req, res) => {
  try {
    const newListing = new Listing(req.body.listing);
    await newListing.save();
    res.redirect(`/listings/${newListing._id}`);
  } catch (err) {
    console.error("Error creating listing:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Show Route (detail) - validate id first
app.get("/listings/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).render('404', { message: 'Invalid listing id' });
    }
    const listing = await Listing.findById(id).lean();
    if (!listing) {
      return res.status(404).render('404', { message: 'Listing not found' });
    }
    res.render("listings/show", { listing });
  } catch (err) {
    console.error("Error fetching listing:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Edit Route - show edit form
app.get("/listings/:id/edit", async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).send("Invalid id");
    }
    const listing = await Listing.findById(id);
    if (!listing) {
      return res.status(404).send("Listing not found");
    }
    res.render("listings/edit", { listing });
  } catch (err) {
    console.error("Error fetching listing for edit:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Update Route
app.put("/listings/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).send("Invalid id");
    }
    await Listing.findByIdAndUpdate(id, req.body.listing, { runValidators: true });
    res.redirect(`/listings/${id}`);
  } catch (err) {
    console.error("Error updating listing:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Delete Route
app.delete("/listings/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).send("Invalid id");
    }
    const deletedListing = await Listing.findByIdAndDelete(id);
    console.log("Deleted listing:", deletedListing);
    res.redirect("/listings");
  } catch (err) {
    console.error("Error deleting listing:", err);
    res.status(500).send("Internal Server Error");
  }
});

// Static pages
app.get("/about", (req, res) => {
  res.render("about");
});
app.get("/contact", (req, res) => {
  res.render("contact");
});
app.get("/terms", (req, res) => {
  res.render("terms");
});
app.get("/privacy", (req, res) => {
  res.render("privacy");
});

// 404 handler (simple)
app.use((req, res) => {
  res.status(404).render('404', { message: 'Page not found' });
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
