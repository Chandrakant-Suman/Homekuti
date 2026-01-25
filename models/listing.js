const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

const listingSchema = new Schema({

  title: {
    type: String,
    required: true
  },

  description: {
    type: String,
  },

  image: {
    type: String,
    required: true,
    default: "/images/listings/example.jpg",

    set: (value) => {
      if (!value || value.trim() === "") {
        return "/images/listings/example.jpg";
      }
      return value;
    }
  },

  price: {
    type: Number,
    required: true
  },

  location: {
    type: String,
    required: true
  },

  country: {
    type: String,
    required: true
  },

  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    }
  ]

});


/* Auto-delete reviews when listing is deleted */
listingSchema.post("findOneAndDelete", async function (listing) {

  if (listing) {
    await Review.deleteMany({
      _id: { $in: listing.reviews }
    });
  }

});


const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
