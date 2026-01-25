// app.js
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const maintenance = require("./middlewares/maintenance");
const Review = require("./models/review.js");
const fs = require("fs");
const path = require("path");
const downloadImage = require("./utils/downloadImage");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError");
const wrapAsync = require("./utils/wrapAsync.js");
const { listingSchema } = require("./schema.js");
const { reviewSchema } = require("./schema.js");

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
   maintenance,
   wrapAsync(async (req, res) => {
      const featuredListings = await Listing.aggregate([
         { $sample: { size: 3 } },
      ]);
      res.render("home", { featuredListings });
   }),
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

const validateReview = (req, res, next) => {
   let { error } = reviewSchema.validate(req.body);
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
   maintenance,
   wrapAsync(async (req, res) => {
      const allListings = await Listing.find({});
      res.render("listings/index", { allListings });
   }),
);

// NEW
app.get("/listings/new", maintenance, (req, res) => {
   res.render("listings/new");
});

// CREATE route (Browser-based)
app.post(
   "/listings",
   maintenance,
   validateListing,
   wrapAsync(async (req, res) => {

      let listingData = req.body.listing;

      let imageUrl = listingData.image;

      // DEFAULT IMAGE
      if (!imageUrl || imageUrl.trim() === "") {
         listingData.image = "/images/listings/example.jpg";
      }

      // CUSTOM IMAGE → DOWNLOAD
      else {

         const filename =
            "listing_" +
            Date.now() +
            path.extname(imageUrl.split("?")[0]);

         await downloadImage(imageUrl, filename);

         listingData.image = `/images/listings/${filename}`;
      }

      const newListing = new Listing(listingData);
      await newListing.save();

      res.redirect("/listings");
   })
);


// SHOW
app.get(
   "/listings/:id",
   wrapAsync(async (req, res, next) => {
      let { id } = req.params;
      const listing = await Listing.findById(id).populate("reviews");
      // If listing not found
      if (!listing) {
         // res.render("error", "Listing not found!");
         // return res.redirect("/listings");
         next(new ExpressError(404, "Listing Not Found"));
      }

      res.render("listings/show", { listing });
   }),
);

// EDIT
app.get(
   "/listings/:id/edit",
   wrapAsync(async (req, res) => {
      let { id } = req.params;
      const listing = await Listing.findById(id);
      res.render("listings/edit.ejs", { listing });
   }),
);

// UPDATE
app.put(
   "/listings/:id",
   maintenance,
   validateListing,
   wrapAsync(async (req, res) => {

      let { id } = req.params;
      let updatedData = req.body.listing;

      const listing = await Listing.findById(id);

      if (!listing) {
         throw new ExpressError(404, "Listing Not Found");
      }

      let newImageUrl = updatedData.image;
      let oldImage = listing.image;

      /* If image is changed */
      if (
         newImageUrl &&
         newImageUrl.trim() !== "" &&
         newImageUrl !== oldImage
      ) {

         // Delete old image (if not default)
         if (oldImage !== "/images/listings/example.jpg") {

            const oldImagePath = path.join(
               __dirname,
               "..",
               "public",
               oldImage
            );

            if (fs.existsSync(oldImagePath)) {
               fs.unlinkSync(oldImagePath);
            }
         }

         // Download new image
         const filename =
            "listing_" +
            Date.now() +
            path.extname(newImageUrl.split("?")[0]);

         await downloadImage(newImageUrl, filename);

         updatedData.image = `/images/listings/${filename}`;
      }

      /* If image is empty → use default */
      if (!newImageUrl || newImageUrl.trim() === "") {
         updatedData.image = "/images/listings/example.jpg";
      }

      await Listing.findByIdAndUpdate(id, updatedData, {
         runValidators: true,
         new: true,
      });

      res.redirect(`/listings/${id}`);
   })
);


// DELETE
app.delete(
   "/listings/:id",
   maintenance,
   wrapAsync(async (req, res) => {

      const { id } = req.params;

      const listing = await Listing.findById(id);

      if (!listing) {
         return res.redirect("/listings");
      }

      /* Delete image only if NOT default */
      if (
         listing.image &&
         listing.image !== "/images/listings/example.jpg"
      ) {

         const imagePath = path.join(
            __dirname,
            "..",
            "public",
            listing.image
         );

         if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
         }
      }

      await Listing.findByIdAndDelete(id);

      res.redirect("/listings");
   })
);

// REVIEWS
// post route for adding a review to a listing
app.post(
   "/listings/:id/reviews",
   validateReview,
   wrapAsync(async (req, res) => {
      let listing = await Listing.findById(req.params.id);
      let newReview = new Review(req.body.review);
      listing.reviews.push(newReview);
      await newReview.save();
      await listing.save();

      console.log("Added Review: ", newReview);
      res.redirect(`/listings/${listing._id}`);
   }),
);

// delete review route
app.delete(
   "/listings/:id/reviews/:reviewId",
   wrapAsync(async (req, res) => {
      const { id, reviewId } = req.params;
      await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
      await Review.findByIdAndDelete(reviewId);

      res.redirect(`/listings/${id}`);
   }),
);

// API ROUTE - Get all listings in JSON
app.get(
   "/api/listings",
   wrapAsync(async (req, res) => {
      const allListings = await Listing.find({});
      res.json(allListings);
   }),
);

// STATIC PAGES
app.get("/about", (req, res) => res.render("about"));
app.get("/contact", (req, res) => res.render("contact"));
app.get("/terms", (req, res) => res.render("terms"));
app.get("/privacy", (req, res) => res.render("privacy"));
app.get("/maintenance", (req, res) => res.render("maintenance"));

// -----------------------
// ERROR HANDLING
// -----------------------

// 404 CATCH-ALL
app.use((req, res, next) => {
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
