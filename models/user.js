const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// IMPORTANT: default export fix
const passportLocalMongoose = require("passport-local-mongoose").default 
    || require("passport-local-mongoose");

const userSchema = new Schema({
    name: {
        type: String,
        trim: true
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
    }
});

// Do NOT add password field

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
