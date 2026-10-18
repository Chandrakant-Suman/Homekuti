const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Minimal record kept after an account is deleted (audit / disputes / fraud).
// Deliberately excludes password hash, phone, avatar, wishlist etc.
const deletedUserSchema = new Schema({
    originalId: {
        type: Schema.Types.ObjectId,
        required: true,
    },
    username: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    role: String,
    joinedAt: Date,
    deletedAt: {
        type: Date,
        default: Date.now,
    },
    // "request" = user asked and admin approved; "admin" = removed directly by admin
    method: {
        type: String,
        enum: ["request", "admin"],
        required: true,
    },
    reason: String,
    requestedAt: Date,
    deletedBy: {
        id: { type: Schema.Types.ObjectId, ref: "User" },
        username: String,
    },
});

deletedUserSchema.index({ deletedAt: -1 });
deletedUserSchema.index({ email: 1 });

module.exports = mongoose.model("DeletedUser", deletedUserSchema);
