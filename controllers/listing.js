// controllers/listing.js - Complete fixed version

const Listing = require("../models/listing");
const { geocodeLocation } = require("../utils/geocoding");
const { cloudinary } = require("../cloudConfig");

// Default image from your Cloudinary
const DEFAULT_IMAGE = {
  url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1771003245/Homekuti_DEV/kzjbrisg2uqssvvp99a3.jpg",
  filename: "Homekuti_DEV/kzjbrisg2uqssvvp99a3"
};

module.exports.index = async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index", { allListings });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new");
};

module.exports.showListing = async (req, res) => {
  const { id } = req.params;

  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
      },
    })
    .populate("owner");

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  // Check if using default location
  const isDefaultLocation =
    listing.geometry &&
    listing.geometry.coordinates &&
    listing.geometry.coordinates[0] === 78.9629 &&
    listing.geometry.coordinates[1] === 20.5937;

  res.render("listings/show", { listing, isDefaultLocation });
};

module.exports.createListing = async (req, res) => {
  try {
    const newListing = new Listing(req.body.listing);

    // ✅ Handle image upload - ALWAYS set image field
    if (req.file && req.file.path && req.file.filename) {
      // User uploaded an image successfully
      newListing.image = {
        url: req.file.path,
        filename: req.file.filename,
      };
      console.log("✓ Image uploaded:", req.file.filename);
    } else {
      // No upload or upload failed - use default
      newListing.image = {
        url: DEFAULT_IMAGE.url,
        filename: DEFAULT_IMAGE.filename
      };
      console.log("⚠️  Using default image");
    }

    // Set owner
    newListing.owner = req.user._id;

    // ✅ Geocode with robust error handling
    try {
      const locationString = `${newListing.location}, ${newListing.country}`;
      console.log("🔍 Attempting to geocode:", locationString);
      
      const geoData = await geocodeLocation(locationString);
      
      if (geoData && geoData.coordinates) {
        newListing.geometry = {
          type: "Point",
          coordinates: geoData.coordinates, // [lng, lat]
        };

        if (geoData.isDefault) {
          console.warn("⚠️  Using default coordinates for:", locationString);
        } else {
          console.log("✓ Geocoded successfully:", geoData.coordinates);
        }
      } else {
        // Fallback if geocoding returns invalid data
        newListing.geometry = {
          type: "Point",
          coordinates: [78.9629, 20.5937],
        };
        console.warn("⚠️  Invalid geocode result, using default");
      }
    } catch (geoError) {
      console.error("❌ Geocoding error:", geoError.message);
      // Use default coordinates if geocoding fails
      newListing.geometry = {
        type: "Point",
        coordinates: [78.9629, 20.5937], // Default: Center of India
      };
    }

    // ✅ Save listing - This should ALWAYS succeed
    const savedListing = await newListing.save();

    console.log("✅ Listing created successfully:", savedListing._id);
    console.log("   - Image:", savedListing.image.filename);
    console.log("   - Location:", savedListing.geometry.coordinates);
    
    req.flash("success", "New listing created successfully!");
    res.redirect(`/listings/${savedListing._id}`);
    
  } catch (error) {
    console.error("❌ Error creating listing:", error);
    req.flash("error", "Failed to create listing. Please try again.");
    res.redirect("/listings/new");
  }
};

module.exports.editListing = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  res.render("listings/edit", { listing });
};

module.exports.updateListing = async (req, res) => {
  try {
    const { id } = req.params;

    const listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

    if (!listing) {
      req.flash("error", "Listing not found!");
      return res.redirect("/listings");
    }

    // ✅ Handle new image upload
    if (req.file && req.file.path && req.file.filename) {
      // Delete old image from Cloudinary (if not default)
      if (listing.image && 
          listing.image.filename && 
          listing.image.filename !== DEFAULT_IMAGE.filename) {
        try {
          await cloudinary.uploader.destroy(listing.image.filename);
          console.log("✓ Old image deleted from Cloudinary:", listing.image.filename);
        } catch (deleteError) {
          console.warn("⚠️  Failed to delete old image:", deleteError.message);
        }
      }

      // Set new image
      listing.image = {
        url: req.file.path,
        filename: req.file.filename,
      };
      console.log("✓ Image updated:", req.file.filename);
    }
    // If no new image uploaded, keep existing image (don't change it)

    // ✅ Re-geocode if location or country changed
    try {
      if (req.body.listing.location || req.body.listing.country) {
        const locationString = `${listing.location}, ${listing.country}`;
        console.log("🔍 Re-geocoding:", locationString);
        
        const geoData = await geocodeLocation(locationString);

        if (geoData && geoData.coordinates) {
          listing.geometry = {
            type: "Point",
            coordinates: geoData.coordinates,
          };
          console.log("✓ Location updated:", geoData.coordinates);
        }
      }
    } catch (geoError) {
      console.error("❌ Geocoding error during update:", geoError.message);
      // Keep existing coordinates on error
    }

    await listing.save();

    req.flash("success", "Listing updated successfully!");
    res.redirect(`/listings/${id}`);
    
  } catch (error) {
    console.error("❌ Error updating listing:", error);
    req.flash("error", "Failed to update listing. Please try again.");
    res.redirect(`/listings/${req.params.id}/edit`);
  }
};

module.exports.deleteListing = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the listing first to get image info
    const listing = await Listing.findById(id);
    
    if (!listing) {
      req.flash("error", "Listing not found!");
      return res.redirect("/listings");
    }

    // ✅ Delete image from Cloudinary (if not default)
    if (listing.image && 
        listing.image.filename && 
        listing.image.filename !== DEFAULT_IMAGE.filename) {
      try {
        await cloudinary.uploader.destroy(listing.image.filename);
        console.log("✓ Image deleted from Cloudinary:", listing.image.filename);
      } catch (cloudinaryError) {
        console.warn("⚠️  Failed to delete image from Cloudinary:", cloudinaryError.message);
        // Continue with listing deletion even if Cloudinary deletion fails
      }
    } else {
      console.log("ℹ️  Skipping default image deletion");
    }

    // Delete the listing (reviews will be auto-deleted via post middleware)
    await Listing.findByIdAndDelete(id);

    console.log("✅ Listing deleted successfully:", id);
    req.flash("success", "Listing deleted!");
    res.redirect("/listings");
    
  } catch (error) {
    console.error("❌ Error deleting listing:", error);
    req.flash("error", "Failed to delete listing.");
    res.redirect("/listings");
  }
};