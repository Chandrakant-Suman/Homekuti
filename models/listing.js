const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");

// Default image constant
const DEFAULT_IMAGE = {
  url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1771003245/Homekuti_DEV/kzjbrisg2uqssvvp99a3.jpg",
  filename: "Homekuti_DEV/DEFAULT"
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

  // Nightly price covers BASE_GUESTS; each extra guest adds this % of the
  // nightly price per night (set by the host)
  extraGuestPercent: {
    type: Number,
    min: 0,
    max: 100,
    default: 20
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
      type: mongoose.Schema.Types.ObjectId,
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
      default: [78.9629, 20.5937]
    },
    // true when geocoding failed and the fallback (centre of India) is stored.
    // Deliberately has NO default: legacy listings saved before this field
    // existed stay `undefined`, so the controller falls back to a coordinate
    // check instead of wrongly flagging them as approximate.
    isApproximate: {
      type: Boolean
    }
  },

  genre: {
    type: String,
    enum: ["Beach", "Mountain", "City", "Luxury", "Budget", "Heritage", "Forest", "Countryside", "Island", "Desert"],
    default: "City",
  },

  avgRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },

  totalReviews: {
    type: Number,
    default: 0,
  },

  // Admin / ground-level verification. Every listing starts "pending" (shown
  // as "Not verified") and appears in the admin verification queue.
  verification: {
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: Date,
    reviewedBy: {
      id: { type: Schema.Types.ObjectId, ref: "User" },
      username: String,
    },
    note: { type: String, trim: true, maxlength: 500 },  // admin's note, or rejection reason
  },

});

listingSchema.index({ "verification.status": 1, "verification.requestedAt": 1 });


/* Auto-delete reviews when listing is deleted */
listingSchema.post("findOneAndDelete", async function (listing) {

  if (listing) {
    await Review.deleteMany({
      _id: { $in: listing.reviews }
    });
  }

});


const Listing = mongoose.models.Listing || mongoose.model("Listing", listingSchema);
module.exports = Listing;