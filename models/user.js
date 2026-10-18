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
    // Forgot-password flow: only a SHA-256 hash of the emailed token is stored
    resetPasswordToken: {
        type: String,
        select: false,
    },
    resetPasswordExpires: Date,
    resetPasswordRequestedAt: Date,
    // Account deletion request (reviewed by admin)
    deleteRequest: {
        status: {
            type: String,
            enum: ["none", "pending", "rejected"],
            default: "none",
        },
        reason: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        requestedAt: Date,
        reviewedAt: Date,
    },
});

// Indexes
userSchema.index({ googleId: 1 });
userSchema.index({ "deleteRequest.status": 1 });

// ── Primary admin protection (backstop for every code path) ──
const { isProtectedAdmin, protectedEmailRegex } = require("../utils/protectedAdmin");
const protectedError = () =>
    Object.assign(new Error("The primary admin account cannot be demoted or deleted."), { statusCode: 403 });

userSchema.pre("save", function () {
    if (!this.isNew && this.isModified("role") && this.role !== "admin" && isProtectedAdmin(this)) {
        throw protectedError();
    }
});

userSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"], async function () {
    const update = this.getUpdate() || {};
    const role = update.$set?.role ?? update.role;
    if (role === undefined || role === "admin") return;
    if (await this.model.exists({ ...this.getFilter(), email: protectedEmailRegex() })) {
        throw protectedError();
    }
});

userSchema.pre(["findOneAndDelete", "deleteOne", "deleteMany"], { document: false, query: true }, async function () {
    if (await this.model.exists({ ...this.getFilter(), email: protectedEmailRegex() })) {
        throw protectedError();
    }
});

userSchema.plugin(passportLocalMongoose, {
    // Allow signing in with either username or email
    usernameQueryFields: ["email"],
    // Case-insensitive match, so "Admin" / "HomeKuti247@Gmail.com" still work
    findByUsername: (model, query) => model.findOne(query).collation({ locale: "en", strength: 2 }),
});

module.exports = mongoose.model("User", userSchema);
