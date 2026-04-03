const express = require("express");
const router = express.Router({ mergeParams: true });
const reviewController = require("../controllers/reviews");
const { isLoggedIn } = require("../middlewares/authenticate");
const { isReviewAuthor } = require("../middlewares/authorize");
const { validateReview } = require("../middlewares/validateReview");
const wrapAsync = require("../utils/wrapAsync");

// Create review
router.post("/", isLoggedIn, validateReview, wrapAsync(reviewController.createReview));

// Delete review
router.delete("/:reviewId", isLoggedIn, isReviewAuthor, wrapAsync(reviewController.deleteReview));

module.exports = router;
