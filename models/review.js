const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
  comment: String,
  rating: Number,
  author: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  // The completed stay this review is for. Reviews written before verified
  // reviews existed have no booking and are shown without the "Verified stay" badge.
  listing: { type: Schema.Types.ObjectId, ref: "Listing" },
  booking: { type: Schema.Types.ObjectId, ref: "Booking" },
  createdAt: { type: Date, default: Date.now },
});

// One review per stay (only enforced where a booking is recorded)
reviewSchema.index(
  { booking: 1 },
  { unique: true, partialFilterExpression: { booking: { $exists: true } } }
);

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);

module.exports = Review;
