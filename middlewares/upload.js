// middlewares/upload.js - Multer with Cloudinary storage

const multer = require("multer");
const { storage } = require("../cloudConfig");
const ExpressError = require("../utils/ExpressError");

// File filter for validation
const fileFilter = (req, file, cb) => {
  // Allowed MIME types
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true); // Accept file
  } else {
    cb(
      new ExpressError(
        400,
        "Invalid file type. Only JPG, PNG, and WEBP images are allowed."
      ),
      false
    );
  }
};

// Configure multer with Cloudinary storage
const upload = multer({
  storage: storage, // ✅ Use Cloudinary storage (from cloudConfig.js)
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only 1 file per upload
  },
  fileFilter: fileFilter,
});

module.exports = upload;