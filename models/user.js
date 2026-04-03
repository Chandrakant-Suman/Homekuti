const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// IMPORTANT: default export fix
const passportLocalMongoose = require("passport-local-mongoose").default;
const userSchema = new Schema({
    username: {
        type: String,
        trim: true,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    // Google OAuth
    googleId: {
        type: String,
    },
    avatar: {
        type: String,
    },
    // Role-based access
    role: {
        type: String,
        enum: ["user", "owner", "admin"],
        default: "user",
    },
    // Wishlist
    wishlist: {
        type: [{
            type: Schema.Types.ObjectId,
            ref: "Listing",
        }],
        default: [],
    },
    // Bookings reference
    bookings: [{
        type: Schema.Types.ObjectId,
        ref: "Booking",
    }],
    // Phone (optional)
    phone: {
        type: String,
    },
});

// Indexes
userSchema.index({ googleId: 1 });

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
