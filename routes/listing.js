const express = require("express");
const router = express.Router();

const wrapAsync = require("../utils/wrapAsync");

const { isLoggedIn } = require("../middlewares/authenicate");
const { isOwner } = require("../middlewares/authorize");
const { validateListing } = require("../middlewares/validateListing");

const listingController = require("../controllers/listing");

// ✅ Modern multer setup (NO cloudinary storage adapter)
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(), // 🚀 latest pattern
  limits: { fileSize: 5 * 1024 * 1024 } // optional: 5MB limit
});

// ================= ROUTES =================

router.route("/")
.get(wrapAsync(listingController.index))
.post(
  isLoggedIn,
  upload.single("listing[image]"), // multer parses multipart
  validateListing,
  wrapAsync(listingController.createListing)
);

// NEW
router.get("/new", isLoggedIn, listingController.renderNewForm);

router.route("/:id")
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

// EDIT
router.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.editListing)
);

module.exports = router;
