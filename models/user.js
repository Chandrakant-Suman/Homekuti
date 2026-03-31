const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// IMPORTANT: default export fix
const passportLocalMongoose = require("passport-local-mongoose").default
    || require("passport-local-mongoose");

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
    }, password: {
        type: String,
        required: false,
    },

    // (Google login support)
    googleId: {
        type: String,
    },
    avatar: {
        type: String,
    }
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
