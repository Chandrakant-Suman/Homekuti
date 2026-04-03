const express = require("express");
const router = express.Router();
const listingController = require("../controllers/listing");
const { isLoggedIn } = require("../middlewares/authenticate");
const { isOwner } = require("../middlewares/authorize");
const { validateListing } = require("../middlewares/validateListing");
const upload = require("../middlewares/upload");
const wrapAsync = require("../utils/wrapAsync");
const Review = require("../models/review");

// Index + Create
router
  .route("/")
  .get(wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.createListing)
  );

// New form
router.get("/new", isLoggedIn, listingController.renderNewForm);

// Show + Update + Delete
router
  .route("/:id")
  .get(wrapAsync(listingController.showListing))
  .put(
    isLoggedIn,
    isOwner,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.updateListing)
  )
  .delete(
    isLoggedIn,
    isOwner,
    wrapAsync(listingController.deleteListing)
  );

// Edit form
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listingController.editListing));

module.exports = router;