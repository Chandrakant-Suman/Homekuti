const Listing = require("../models/listing");
const ExpressError = require("../utils/ExpressError");

const cloudinary = require("../cloudConfig");
const streamifier = require("streamifier");

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
module.exports.createListing = async (req, res, next) => {

    if (!req.file) {
        req.flash("error", "Image is required!");
        return res.redirect("/listings/new");
    }

    // 🔥 Upload buffer to Cloudinary (modern way)
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

    const listing = new Listing(req.body.listing);
    listing.owner = req.user._id;

    // ✅ Cloudinary response
    listing.image = {
        url: result.secure_url,
        filename: result.public_id
    };

    await listing.save();

    req.flash("success", "Successfully created a new listing!");
    res.redirect("/listings");
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

    // Safety patch for old seeded listings
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

    let listing = await Listing.findByIdAndUpdate(
        id,
        { ...req.body.listing },
        { new: true }
    );

    if (!listing) {
        throw new ExpressError(404, "Listing Not Found");
    }

    // If new image uploaded
    if (req.file) {

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
    await Listing.findByIdAndDelete(id);
    req.flash("success", "Successfully deleted the listing!");
    res.redirect("/listings");
};
