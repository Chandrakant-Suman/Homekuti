const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");

const cloudinary = require("../cloudConfig");
const streamifier = require("streamifier");
const axios = require("axios");

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

    if (!req.file) {
        req.flash("error", "Image is required!");
        return res.redirect("/listings/new");
    }

    const uploadStream = () =>
        new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: "Homekuti_DEV" },
                (error, result) => {
                    if (result) resolve(result);
                    else reject(error);
                }
            );
            streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

    async function geocode(location) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;

            const response = await axios.get(url, {
                headers: { "User-Agent": "HomekutiApp" },
                timeout: 5000
            });

            if (!response.data.length) throw new Error("Location not found");

            return [
                parseFloat(response.data[0].lon),
                parseFloat(response.data[0].lat),
            ];
        } catch (err) {
            console.log("Geocode failed → using fallback coords");

            // ⭐ fallback coords (India center-ish)
            return [78.9629, 20.5937];
        }
    }

    const [coords, result] = await Promise.all([
        await geocode(req.body.listing.location),
        await cloudinary.uploader.upload(
            `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
            { folder: "Homekuti_DEV" })
    ]);

    const listing = new Listing(req.body.listing);

    listing.owner = req.user._id;

    listing.image = {
        url: result.secure_url,
        filename: result.public_id
    };

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

    res.render("listings/show", { listing });
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

    // ===== Update location geometry if location changed =====
    if (req.body.listing.location && req.body.listing.location !== listing.location) {

        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${req.body.listing.location}`;

        const response = await axios.get(url, {
            headers: { "User-Agent": "HomekutiApp" }
        });

        if (response.data.length) {
            req.body.listing.geometry = {
                type: "Point",
                coordinates: [
                    parseFloat(response.data[0].lon),
                    parseFloat(response.data[0].lat),
                ]
            };
        }
    }

    listing = await Listing.findByIdAndUpdate(
        id,
        { ...req.body.listing },
        { new: true }
    );

    if (req.file) {

        if (listing.image && listing.image.filename) {
            await cloudinary.uploader.destroy(listing.image.filename);
        }

        const uploadStream = () =>
            new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: "Homekuti_DEV" },
                    (error, result) => {
                        if (result) resolve(result);
                        else reject(error);
                    }
                );
                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });

        const result = await uploadStream();

        listing.image = {
            url: result.secure_url,
            filename: result.public_id
        };

        await listing.save();
    }

    req.flash("success", "Listing updated successfully!");
    res.redirect(`/listings/${id}`);
};


// ================= DELETE LISTING =================
module.exports.deleteListing = async (req, res) => {

    const { id } = req.params;

    const listing = await Listing.findById(id);

    if (listing && listing.image && listing.image.filename) {
        await cloudinary.uploader.destroy(listing.image.filename);
    }

    await Listing.findByIdAndDelete(id);

    req.flash("success", "Successfully deleted the listing!");
    res.redirect("/listings");
};
