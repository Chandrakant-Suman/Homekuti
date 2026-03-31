const express = require("express");
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync");

const { isLoggedIn } = require("../middlewares/authenticate");
const { isOwner } = require("../middlewares/authorize");
const { validateListing } = require("../middlewares/validateListing");

const listingController = require("../controllers/listing");

// ✅ Import centralized upload middleware
const upload = require("../middlewares/upload");

// ================= ROUTES =================

router
  .route("/")
  .get(wrapAsync(listingController.index))
  .post(
    isLoggedIn,
    upload.single("listing[image]"), // Multer with size & type validation
    validateListing,
    wrapAsync(listingController.createListing)
  );

// NEW
router.get("/new", isLoggedIn, listingController.renderNewForm);

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
  .delete(isLoggedIn, isOwner, wrapAsync(listingController.deleteListing));

// EDIT
router.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.editListing)
);

// console.log("isLoggedIn:", typeof isLoggedIn);
// console.log("isOwner:", typeof isOwner);
// console.log("validateListing:", typeof validateListing);
// console.log("upload:", typeof upload);
// console.log("wrapAsync:", typeof wrapAsync);
module.exports = router;