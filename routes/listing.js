const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

// path is of the parent directory of the current file so we use ".."
const Listing = require("../models/listing");
const wrapAsync = require("../utils/wrapAsync");
const ExpressError = require("../utils/ExpressError");
const downloadImage = require("../utils/downloadImage");

const { listingSchema } = require("../schema");

// ================= VALIDATION =================

const validateListing = (req, res, next) => {
    const { error } = listingSchema.validate(req.body);
    if (error) {
        const msg = error.details.map(el => el.message).join(",");
        throw new ExpressError(400, msg);
    }
    next();
};

// ================= ROUTES =================

// INDEX
router.get("/", wrapAsync(async (req, res) => {
    const listings = await Listing.find({});
    res.render("listings/index", { allListings: listings });
}));

// NEW
router.get("/new", (req, res) => {
    res.render("listings/new");
});

// CREATE
router.post(
    "/",
    validateListing,
    wrapAsync(async (req, res) => {
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
        await listing.save();
        req.flash("success", "Successfully created a new listing!");
        res.redirect("/listings");
    })
);

// SHOW
router.get("/:id", wrapAsync(async (req, res) => {

    const listing = await Listing
        .findById(req.params.id)
        .populate("reviews");

    if (!listing) {
        req.flash("error", "Listing Not Found");
        // throw new ExpressError(404, "Listing Not Found");
        return res.redirect("/listings");
    }

    res.render("listings/show", { listing });
}));

// EDIT
router.get("/:id/edit", wrapAsync(async (req, res) => {

    const listing = await Listing.findById(req.params.id);

    if (!listing) {
        req.flash("error", "Listing Not Found");
        // throw new ExpressError(404, "Listing Not Found");
        return res.redirect("/listings");
    }

    res.render("listings/edit", { listing });
}));

// UPDATE
router.put(
    "/:id",
    validateListing,
    wrapAsync(async (req, res) => {

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
    })
);

// DELETE
router.delete("/:id", wrapAsync(async (req, res) => {
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
}));

// ================= EXPORT =================
module.exports = router;