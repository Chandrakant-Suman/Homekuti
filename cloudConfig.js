// cloudConfig.js — Cloudinary SDK + multer storage engine
//
// Note on versions: this project has multer-storage-cloudinary v2, whose
// _handleFile hands multer the RAW Cloudinary response, so the uploaded file
// arrives as `req.file.secure_url` / `req.file.public_id`. Version 4 of that
// package renames them to `req.file.path` / `req.file.filename`.
//
// `fileToImage()` below reads whichever pair is present, so the app works on
// either version and an upgrade won't silently break uploads again.

const cloudinaryPkg = require("cloudinary");
const CloudinaryStorage = require("multer-storage-cloudinary");

// v1 and v2 share one config object, but call it on v2 so the namespace we
// actually use is unambiguous.
cloudinaryPkg.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "Homekuti_DEV";

// The storage engine needs the ROOT package — internally it reaches for
// `this.cloudinary.v2.uploader`.
const storage = new CloudinaryStorage({
  cloudinary: cloudinaryPkg,
  params: {
    folder: CLOUDINARY_FOLDER,
    allowed_formats: ["jpeg", "png", "jpg", "webp"],
    transformation: [{ width: 1200, height: 800, crop: "limit", quality: "auto" }],
  },
});

/**
 * Normalise a multer file into the { url, filename } shape the Listing model
 * stores. Returns null when nothing usable was uploaded, so callers can fall
 * back to the default image deliberately rather than by accident.
 *
 * @param {object} [file] - req.file
 * @returns {{url: string, filename: string}|null}
 */
function fileToImage(file) {
  if (!file) return null;

  const url = file.secure_url || file.url || file.path; // v2 → v4 field names
  const filename = file.public_id || file.filename;

  return url && filename ? { url, filename } : null;
}

module.exports = {
  // Export the v2 namespace: its methods return promises, so `await
  // cloudinary.uploader.destroy(...)` actually waits (the v1 API is
  // callback-based and returns undefined, making the await a no-op).
  cloudinary: cloudinaryPkg.v2,
  storage,
  fileToImage,
  CLOUDINARY_FOLDER,
};
