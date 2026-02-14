const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");
const { required } = require("joi");

// Default image constant
const DEFAULT_IMAGE = {
  url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1771003245/Homekuti_DEV/kzjbrisg2uqssvvp99a3.jpg",
  filename: "Homekuti_DEV/kzjbrisg2uqssvvp99a3"
};

const listingSchema = new Schema({

  title: {
    type: String,
    required: true
  },

  description: {
    type: String,
  },

  image: {
    url: {
      type: String,
      default: DEFAULT_IMAGE.url  // ✅ Default image URL
    },
    filename: {
      type: String,
      default: DEFAULT_IMAGE.filename  // ✅ Default filename
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
  ],
  
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  geometry: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number], // [lng, lat]
      default: [78.9629, 20.5937]  // ✅ Default coordinates (center of India)
    }
  }

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