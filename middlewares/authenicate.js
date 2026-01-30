const Listing = require("../models/listing");
const Review = require("../models/review");

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.flash("error", "You must be signed in first!");
        return res.redirect("/user/signin");
    }
    next();
};

// module.exports.isAuthor = async (req, res, next) => {
//     const { id } = req.params;
//     const listing = await Listing.findById(id);
//     if (!listing.author.equals(req.user._id)) {
//         req.flash("error", "You do not have permission to do that!");
//         return res.redirect(`/listings/${id}`);
//     }
//     next();
// };

// module.exports.isReviewAuthor = async (req, res, next) => {
//     const { id, reviewId } = req.params;
//     const review = await Review.findById(reviewId);
//     if (!review.author.equals(req.user._id)) {
//         req.flash("error", "You do not have permission to do that!");
//         return res.redirect(`/listings/${id}`);
//     }
//     next();
// };