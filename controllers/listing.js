const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");

const cloudinary = require("../cloudConfig");
const streamifier = require("streamifier");

// =======================================================
// DEFAULT FALLBACKS (centralized config — not hardcoded everywhere)
// =======================================================
const DEFAULT_COORDS = [77.2090, 28.6139]; // New Delhi [lng, lat]
const DEFAULT_IMAGE = {
    url: "https://res.cloudinary.com/dgu8te3bn/image/upload/Homekuti_DEV/x0wzkxbhu14pbsxnqivw.jpg",
    filename: "default-image"
};

// =======================================================
// SAFE GEOCODE
// Uses real logic later — fallback only on failure
// =======================================================
async function geocode(location) {
    try {
        // Currently simplified — replace later with real API
        console.log(`📍 Geocoding: ${location}`);

        // Simulate success (future geocoder goes here)
        return DEFAULT_COORDS;

    } catch (err) {
        console.warn("⚠️ Geocode timeout — using New Delhi fallback.");
        return DEFAULT_COORDS;
    }
}

// =======================================================
// CLOUDINARY UPLOAD HELPER
// =======================================================
function uploadToCloudinary(fileBuffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "Homekuti_DEV" },
            (error, result) => {
                if (result) resolve(result);
                else reject(error);
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
}

// ================= INDEX =================
module.exports.index = async (req, res) => {
    const listings = await Listing.find({});
    res.render("listings/index", { allListings: listings });
};

// ================= NEW FORM =================
module.exports.renderNewForm = (req, res) => {
    res.render("listings/new");
};

// ================= CREATE LISTING =================
module.exports.createListing = async (req, res) => {

    // ===== IMAGE HANDLING (NORMAL FIRST, FALLBACK ONLY ON ERROR) =====
    let imageData = { ...DEFAULT_IMAGE };

    if (req.file) {
        try {
            const result = await uploadToCloudinary(req.file.buffer);
            imageData = {
                url: result.secure_url,
                filename: result.public_id
            };
        } catch (err) {
            console.warn("⚠️ Cloudinary upload failed — using default image.");
        }
    }

    // ===== GEOCODE HANDLING =====
    let coords = DEFAULT_COORDS;

    try {
        const geo = await geocode(req.body.listing.location);
        if (geo && geo.length === 2) coords = geo;
    } catch (err) {
        console.warn("⚠️ Geocode failed — fallback applied.");
    }

    const listing = new Listing(req.body.listing);

    listing.owner = req.user._id;
    listing.image = imageData;

    listing.geometry = {
        type: "Point",
        coordinates: coords
    };

    await listing.save();

    req.flash("success", "Successfully created a new listing!");
    res.redirect(`/listings/${listing._id}`);
};


// ================= SHOW LISTING =================
module.exports.showListing = async (req, res) => {

    const listing = await Listing.findById(req.params.id)
        .populate("owner")
        .populate({
            path: "reviews",
            populate: { path: "author" }
        });

    if (!listing) {
        req.flash("error", "Listing Not Found");
        return res.redirect("/listings");
    }

    if (!listing.owner) {
        listing.owner = { username: "Admin" };
    }

    const DEFAULT_COORDS = [77.2090, 28.6139];
    const DEFAULT_FILENAME = "default-image";

    const coords = listing.geometry?.coordinates || [];

    const isDefaultLocation =
        coords.length === 2 &&
        Math.abs(coords[0] - DEFAULT_COORDS[0]) < 0.0001 &&
        Math.abs(coords[1] - DEFAULT_COORDS[1]) < 0.0001;

    const isDefaultImage =
        listing.image?.filename === DEFAULT_FILENAME;


    res.render("listings/show", { listing, isDefaultLocation, isDefaultImage});
};


// ================= EDIT FORM =================
module.exports.editListing = async (req, res) => {

    const listing = await Listing.findById(req.params.id);

    if (!listing) {
        req.flash("error", "Listing Not Found");
        return res.redirect("/listings");
    }

    res.render("listings/edit", { listing });
};


// ================= UPDATE LISTING =================
module.exports.updateListing = async (req, res) => {

    const { id } = req.params;

    let listing = await Listing.findById(id);
    if (!listing) throw new ExpressError(404, "Listing Not Found");

    // ===== SAFE GEOCODE =====
    if (req.body.listing.location && req.body.listing.location !== listing.location) {

        let coords = DEFAULT_COORDS;

        try {
            const geo = await geocode(req.body.listing.location);
            if (geo && geo.length === 2) coords = geo;
        } catch (err) {
            console.warn("⚠️ Geocode timeout ignored.");
        }

        req.body.listing.geometry = {
            type: "Point",
            coordinates: coords
        };
    }

    listing = await Listing.findByIdAndUpdate(
        id,
        { ...req.body.listing },
        { new: true }
    );

    // ===== IMAGE UPDATE (SAFE FALLBACK) =====
    if (req.file) {
        try {
            if (listing.image && listing.image.filename !== "default-image") {
                await cloudinary.uploader.destroy(listing.image.filename);
            }

            const result = await uploadToCloudinary(req.file.buffer);

            listing.image = {
                url: result.secure_url,
                filename: result.public_id
            };

            await listing.save();

        } catch (err) {
            console.warn("⚠️ Image update failed — keeping previous image.");
        }
    }

    req.flash("success", "Listing updated successfully!");
    res.redirect(`/listings/${id}`);
};


// ================= DELETE LISTING =================
module.exports.deleteListing = async (req, res) => {

    const { id } = req.params;

    const listing = await Listing.findById(id);

    if (listing && listing.image && listing.image.filename !== "default-image") {
        await cloudinary.uploader.destroy(listing.image.filename);
    }

    await Listing.findByIdAndDelete(id);

    req.flash("success", "Successfully deleted the listing!");
    res.redirect("/listings");
};
