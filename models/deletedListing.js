const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Minimal record kept after a listing is deleted (audit / disputes / fraud).
// Images are removed from Cloudinary, so no image URL is stored.
const deletedListingSchema = new Schema({
    originalId: {
        type: Schema.Types.ObjectId,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    location: String,
    country: String,
    price: Number,
    genre: String,
    owner: {
        id: { type: Schema.Types.ObjectId, ref: "User" },
        username: String,
        email: String,
    },
    createdAt: Date,
    deletedAt: {
        type: Date,
        default: Date.now,
    },
    // "owner" = deleted by its host; "admin" = removed by an admin
    method: {
        type: String,
        enum: ["owner", "admin"],
        required: true,
    },
    deletedBy: {
        id: { type: Schema.Types.ObjectId, ref: "User" },
        username: String,
    },
    // Snapshot of activity at deletion time
    totalBookings: {
        type: Number,
        default: 0,
    },
    totalReviews: {
        type: Number,
        default: 0,
    },
    avgRating: Number,
});

deletedListingSchema.index({ deletedAt: -1 });
deletedListingSchema.index({ "owner.id": 1 });

module.exports = mongoose.model("DeletedListing", deletedListingSchema);
