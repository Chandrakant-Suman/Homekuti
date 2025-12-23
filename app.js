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
const { listingSchema } = require("./schema.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/Homekuti";

// -----------------------
// DATABASE
// -----------------------
main()
   .then(() => console.log("Connected to MongoDB"))
   .catch((err) => console.log("Mongo Error:", err));

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
app.use(express.json()); // important for APIs

app.use((req, res, next) => {
   res.locals.activeRoute = req.path;
   res.locals.user = req.user || null;
   next();
});

// -----------------------
// ROUTES
// -----------------------

// HOME
app.get(
   "/",
   wrapAsync(async (req, res) => {
      const featuredListings = await Listing.aggregate([
         { $sample: { size: 3 } },
      ]);
      res.render("home", { featuredListings });
   })
);

const validateListing = (req, res, next) => {
   let { error } = listingSchema.validate(req.body);
   if (error) {
      let errorMessage = error.details.map((el) => el.message).join(", ");
      console.log(errorMessage);
      throw new ExpressError(400, errorMessage);
   } else {
      next();
   }
};

// INDEX
app.get(
   "/listings",
   wrapAsync(async (req, res) => {
      const allListings = await Listing.find({});
      res.render("listings/index", { allListings });
   })
);

// NEW
app.get("/listings/new", (req, res) => {
   res.render("listings/new");
});

// CREATE route (Browser-based)
app.post(
   "/listings",
   validateListing,
   wrapAsync(async (req, res) => {
      if(req.body=== undefined){
          throw new ExpressError(400, "Invalid Listing Data");
      }
      await new Listing(req.body.listing).save();
      res.redirect("/listings");
   })
);

// SHOW
app.get(
   "/listings/:id",
   wrapAsync(async (req, res) => {
      let { id } = req.params;
      const listing = await Listing.findById(id);
      res.render("listings/show", { listing });
   })
);

// EDIT
app.get(
   "/listings/:id/edit",
   wrapAsync(async (req, res) => {
      let { id } = req.params;
      const listing = await Listing.findById(id);
      res.render("listings/edit.ejs", { listing });
   })
);

// UPDATE
app.put(
   "/listings/:id",
   validateListing,
   wrapAsync(async (req, res) => {
      let { id } = req.params;
      const listing = await Listing.findByIdAndUpdate(
         id,
         { ...req.body.listing },
         { runValidators: true, new: true }
      );
      res.redirect(`/listings/${id}`);
   })
);

// DELETE
app.delete(
   "/listings/:id",
   wrapAsync(async (req, res) => {
      let { id } = req.params;
      let deletedListing = await Listing.findByIdAndDelete(id);
      console.log(deletedListing);
      res.redirect("/listings");
   })
);

// API ROUTE - Get all listings in JSON
app.get(
   "/api/listings",
   wrapAsync(async (req, res) => {
      const allListings = await Listing.find({});
      res.json(allListings);
   })
);

// STATIC PAGES
app.get("/about", (req, res) => res.render("about"));
app.get("/contact", (req, res) => res.render("contact"));
app.get("/terms", (req, res) => res.render("terms"));
app.get("/privacy", (req, res) => res.render("privacy"));


// -----------------------
// ERROR HANDLING
// -----------------------

// 404 CATCH-ALL
app.use( (req, res, next) => {
   next(new ExpressError(404, "Page Not Found"));
});

// CENTRAL ERROR HANDLER
app.use((err, req, res, next) => {
   const { statusCode = 500, message = "Something went wrong" } = err;
   res.status(statusCode).render("error.ejs", { err });
   // res.status(statusCode).send(message);
});

// SERVER
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
   console.log(`Server running on port ${PORT}`);
});
