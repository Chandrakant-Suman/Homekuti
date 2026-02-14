// cloudConfig.js - Cloudinary configuration with multer-storage-cloudinary

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary Storage for Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Homekuti_DEV",
    allowedFormats: ["jpeg", "jpg", "png", "webp"],
    // Optionally, you can add transformations
    // transformation: [{ width: 1000, height: 1000, crop: "limit" }],
  },
});

module.exports = {
  cloudinary,
  storage,
};