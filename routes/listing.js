const express = require("express");
const router = express.Router();

// path is of the parent directory of the current file so we use ".."
const wrapAsync = require("../utils/wrapAsync");

const { isLoggedIn } = require("../middlewares/authenicate");
const { isOwner } = require("../middlewares/authorize");
const { validateListing } = require("../middlewares/validateListing");

const listingController = require("../controllers/listing");

// ================= ROUTES =================

// INDEX
router.get(
    "/",
    wrapAsync(listingController.index)
);

// NEW
router.get("/new", isLoggedIn, listingController.renderNewForm);

// CREATE
router.post(
    "/",
    isLoggedIn,
    validateListing,
    wrapAsync(listingController.createListing)
);

// SHOW
router.get(
    "/:id",
    wrapAsync(listingController.showListing)
);

// EDIT
router.get(
    "/:id/edit",
    isLoggedIn,
    isOwner,
    wrapAsync(listingController.editListing)
);

// UPDATE
router.put(
    "/:id",
    isLoggedIn,
    isOwner,
    validateListing,
    wrapAsync(listingController.updateListing)
);

// DELETE
router.delete(
    "/:id",
    isLoggedIn,
    isOwner,
    wrapAsync(listingController.deleteListing)
);

// ================= EXPORT =================
module.exports = router;