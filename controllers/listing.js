const Listing = require("../models/listing");
const downloadImage = require("../utils/downloadImage");
const path = require("path");

module.exports.index = async (req, res) => {
    const listings = await Listing.find({});
    res.render("listings/index", { allListings: listings });
};

module.exports.renderNewForm = (req, res) => {
    res.render("listings/new");
};
module.exports.createListing = async (req, res) => {
    let data = req.body.listing;
    // Default image
    if (!data.image || data.image.trim() === "") {
        data.image = "/images/listings/example.jpg";
    }
    else {
        const filename =
            "listing_" +
            Date.now() +
            path.extname(data.image.split("?")[0]);
        await downloadImage(data.image, filename);
        data.image = `/images/listings/${filename}`;
    }
    const listing = new Listing(data);
    listing.owner = req.user._id;
    await listing.save();

    req.flash("success", "Successfully created a new listing!");
    res.redirect("/listings");
};
module.exports.showListing = async (req, res) => {
    const listing = await Listing
        .findById(req.params.id)
        .populate("owner")
        .populate({
            path: "reviews",
            populate: { path: "author" }
        });

    if (!listing) {
        req.flash("error", "Listing Not Found");
        // throw new ExpressError(404, "Listing Not Found");
        return res.redirect("/listings");
    }
    res.render("listings/show", { listing });
};
module.exports.editListing = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
        req.flash("error", "Listing Not Found");
        // throw new ExpressError(404, "Listing Not Found");
        return res.redirect("/listings");
    }
    res.render("listings/edit", { listing });
};
module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    let data = req.body.listing;
    const listing = await Listing.findById(id);
    if (!listing) {
        throw new ExpressError(404, "Listing Not Found");
    }
    // Handle Image Update
    if (data.image && data.image !== listing.image) {
        if (listing.image !== "/images/listings/example.jpg") {
            const oldPath = path.join(
                __dirname,
                "..",
                "public",
                listing.image
            );
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
        const filename =
            "listing_" +
            Date.now() +
            path.extname(data.image.split("?")[0]);
        await downloadImage(data.image, filename);
        data.image = `/images/listings/${filename}`;
    }
    await Listing.findByIdAndUpdate(id, data);
    req.flash("success", "Listing updated successfully!");
    res.redirect(`/listings/${id}`);
};
module.exports.deleteListing = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.redirect("/listings");
    if (listing.image !== "/images/listings/example.jpg") {
        const imgPath = path.join(
            __dirname,
            "..",
            "public",
            listing.image
        );
        if (fs.existsSync(imgPath)) {
            fs.unlinkSync(imgPath);
        }
    }
    await Listing.findByIdAndDelete(req.params.id);
    console.log("Deleted Listing:", req.params.id);
    req.flash("success", "Successfully deleted the listing!");
    res.redirect("/listings");
};
