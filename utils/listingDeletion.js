const Listing = require("../models/listing");
const Booking = require("../models/booking");
const DeletedListing = require("../models/deletedListing");
const { cloudinary } = require("../cloudConfig");

const DEFAULT_IMAGE_FILENAME = "Homekuti_DEV/kzjbrisg2uqssvvp99a3";

/**
 * Delete a listing's image from Cloudinary, skipping the shared default (which
 * every listing without an upload points at — deleting it would blank them all).
 * Failures are logged, not thrown: a leftover file is not worth failing the
 * user's delete/update over.
 */
async function destroyImage(image) {
  const filename = image?.filename;
  if (!filename || filename === DEFAULT_IMAGE_FILENAME) return;

  try {
    await cloudinary.uploader.destroy(filename);
  } catch (err) {
    console.error(`Cloudinary cleanup failed for "${filename}":`, err.message);
  }
}

/**
 * Keep a minimal record of the listing, then delete it (reviews are removed
 * by the listing's findOneAndDelete hook) and its uploaded image.
 * `listing.owner` may be populated or a bare id.
 */
async function archiveAndDeleteListing(listing, { method, deletedBy }) {
  await listing.populate("owner", "username email");
  const totalBookings = await Booking.countDocuments({ listing: listing._id });

  const archived = await DeletedListing.create({
    originalId: listing._id,
    title: listing.title,
    location: listing.location,
    country: listing.country,
    price: listing.price,
    genre: listing.genre,
    owner: listing.owner
      ? { id: listing.owner._id, username: listing.owner.username, email: listing.owner.email }
      : undefined,
    createdAt: listing._id.getTimestamp(),
    method,
    deletedBy: { id: deletedBy._id, username: deletedBy.username },
    totalBookings,
    totalReviews: listing.reviews?.length || 0,
    avgRating: listing.avgRating,
  });

  try {
    await Listing.findByIdAndDelete(listing._id);
  } catch (err) {
    // Roll back so the archive never claims a listing that still exists
    await DeletedListing.findByIdAndDelete(archived._id);
    throw err;
  }

  // Only after the delete succeeded; the image is gone for good after this
  await destroyImage(listing.image);
}

module.exports = { destroyImage, archiveAndDeleteListing };
