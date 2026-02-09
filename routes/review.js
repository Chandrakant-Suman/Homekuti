const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync");

const { isLoggedIn } = require("../middlewares/authenicate");
const { validateReview } = require("../middlewares/validateReview");
const { isReviewAuthor } = require("../middlewares/authorize");

const reviewController = require("../controllers/reviews");

// ADD REVIEW
router.post(
    "/",
    isLoggedIn,
    validateReview,
    wrapAsync(reviewController.addReview)
);

// DELETE REVIEW
router.delete(
    "/:reviewId",
    isLoggedIn,
    isReviewAuthor,
    wrapAsync(reviewController.deleteReview)
);


module.exports = router;