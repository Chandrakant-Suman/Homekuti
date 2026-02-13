// middlewares/upload.js
// Multer configuration with file size and type validation

const multer = require("multer");
const ExpressError = require("../utils/ExpressError");

// ================= MULTER CONFIGURATION =================

const storage = multer.memoryStorage(); // Store in memory for Cloudinary upload

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

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit (SERVER-SIDE VALIDATION)
    files: 1, // Only 1 file per upload
  },
  fileFilter: fileFilter,
});

module.exports = upload;