const mongoose = require("mongoose");
const Listing = require("../models/listing");
const Review = require("../models/review");

module.exports.addReview = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
        req.flash("error", "Listing not found");
        return res.redirect("/listings");
    }
    const review = new Review(req.body.review);
    if (!req.user) {
        req.flash("error", "Login required");
        return res.redirect("/user/signin");
    }

    review.author = req.user._id;
    await review.save(); // Save review first
    listing.reviews.push(review._id); // Push ONLY the ID
    await listing.save();
    req.flash("success", "Review added successfully!");
    res.redirect(`/listings/${listing._id}`);
};

module.exports.deleteReview = async (req, res) => {
  const { id, reviewId } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    await Review.findByIdAndDelete(reviewId, { session });

    await Listing.findByIdAndUpdate(
      id,
      { $pull: { reviews: reviewId } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    req.flash("success", "Review deleted successfully!");
    res.redirect(`/listings/${id}`);

  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error(err);
    req.flash("error", "Failed to delete review");
    res.redirect(`/listings/${id}`);
  }
};