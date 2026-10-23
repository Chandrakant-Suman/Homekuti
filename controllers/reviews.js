const Review = require("../models/review");
const Listing = require("../models/listing");
const { getReviewEligibility } = require("../utils/reviewEligibility");

module.exports.createReview = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    req.flash("error", "Listing not found");
    return res.redirect("/listings");
  }

  const eligibility = await getReviewEligibility(req.user, listing);
  if (!eligibility.eligible) {
    req.flash("error", eligibility.message);
    return res.redirect(`/listings/${listing._id}`);
  }

  const { rating, comment } = req.body.review;
  const newReview = new Review({
    rating,
    comment,
    author: req.user._id,
    listing: listing._id,
    booking: eligibility.booking._id,
  });
  try {
    await newReview.save();
  } catch (err) {
    if (err.code === 11000) {   // double submit for the same stay
      req.flash("error", "You've already reviewed this stay.");
      return res.redirect(`/listings/${listing._id}`);
    }
    throw err;
  }

  listing.reviews.push(newReview._id);

  // Recalculate avgRating
  const allReviews = await Review.find({ _id: { $in: listing.reviews } });
  const avg = allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;
  listing.avgRating = Math.round(avg * 10) / 10;
  listing.totalReviews = allReviews.length;

  await listing.save();
  req.flash("success", "Thanks for reviewing your stay!");
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
