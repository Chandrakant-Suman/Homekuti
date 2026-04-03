const Review = require("../models/review");
const Listing = require("../models/listing");

module.exports.createReview = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    req.flash("error", "Listing not found");
    return res.redirect("/listings");
  }

  const newReview = new Review(req.body.review);
  newReview.author = req.user._id;
  await newReview.save();

  listing.reviews.push(newReview._id);

  // Recalculate avgRating
  const allReviews = await Review.find({ _id: { $in: listing.reviews } });
  const avg = allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;
  listing.avgRating = Math.round(avg * 10) / 10;
  listing.totalReviews = allReviews.length;

  await listing.save();
  req.flash("success", "Review added!");
  res.redirect(`/listings/${listing._id}`);
};

module.exports.deleteReview = async (req, res) => {
  const { id, reviewId } = req.params;

  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
  await Review.findByIdAndDelete(reviewId);

  // Recalculate avgRating
  const listing = await Listing.findById(id).populate("reviews");
  if (listing) {
    if (listing.reviews.length === 0) {
      listing.avgRating = 0;
      listing.totalReviews = 0;
    } else {
      const avg = listing.reviews.reduce((acc, r) => acc + r.rating, 0) / listing.reviews.length;
      listing.avgRating = Math.round(avg * 10) / 10;
      listing.totalReviews = listing.reviews.length;
    }
    await listing.save();
  }

  req.flash("success", "Review deleted.");
  res.redirect(`/listings/${id}`);
};
