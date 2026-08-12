const Listing = require("../models/listing");
const User = require("../models/user");
const { geocodeToGeometry, isDefaultCoordinates } = require("../utils/geocoding");
const { cloudinary } = require("../cloudConfig");

const DEFAULT_IMAGE = {
  url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1771003245/Homekuti_DEV/kzjbrisg2uqssvvp99a3.jpg",
  filename: "Homekuti_DEV/kzjbrisg2uqssvvp99a3",
};

// Resolves to a GeoJSON Point; never throws (see utils/geocoding.js)
const geocodeSafe = (location, country) => geocodeToGeometry(location, country);

module.exports.index = async (req, res) => {
  const { search, genre } = req.query;
  const filter = {};

  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), "i");
    filter.$or = [
      { title: regex },
      { location: regex },
      { country: regex },
      { description: regex }
    ];
  }

  if (genre && genre !== "all") {
    filter.genre = genre;
  }

  const allListings = await Listing.find(filter).lean();

  const genres = ["Beach","Mountain","City","Luxury","Budget","Heritage","Forest","Countryside","Island","Desert"];

  // 🔥 AJAX request (for real-time search)
  if (req.xhr) {
    return res.render("listings/index", {
      allListings,
      genres,
      search: search || "",
      activeGenre: genre || "all",
      layout: false
    });
  }

  res.render("listings/index", {
    allListings,
    genres,
    search: search || "",
    activeGenre: genre || "all",
  });
};

module.exports.renderNewForm = (req, res) => {
  const genres = ["Beach", "Mountain", "City", "Luxury", "Budget", "Heritage", "Forest", "Countryside", "Island", "Desert"];
  res.render("listings/new", { genres });
};

module.exports.showListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  const isWishlisted = req.user?.wishlist?.some(
    (id) => id.equals(listing._id)
  ) || false;

  // Prefer the stored flag; fall back to a coordinate check for older listings
  // saved before `isApproximate` existed.
  const isDefaultLocation =
    listing.geometry?.isApproximate ??
    isDefaultCoordinates(listing.geometry?.coordinates);
  // console.log("USER:", req.user);
  // console.log("WISHLIST:", req.user?.wishlist);

  res.render("listings/show", { listing, isDefaultLocation, isWishlisted });
};

module.exports.createListing = async (req, res) => {
  const newListing = new Listing(req.body.listing);

  newListing.image = (req.file?.path && req.file?.filename)
    ? { url: req.file.path, filename: req.file.filename }
    : DEFAULT_IMAGE;

  newListing.owner = req.user._id;
  newListing.geometry = await geocodeSafe(newListing.location, newListing.country);

  await newListing.save();

  // Promote user to owner role if still plain 'user'
  if (req.user.role === "user") {
    await User.findByIdAndUpdate(req.user._id, { role: "owner" });
  }

  if (newListing.geometry?.isApproximate) {
    req.flash(
      "success",
      "New listing created! We couldn't pin the exact spot — edit the listing with a more specific location (e.g. \"Calangute, Goa\") to fix the map."
    );
  } else {
    req.flash("success", "New listing created successfully!");
  }
  res.redirect(`/listings/${newListing._id}`);
};

module.exports.editListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }
  const genres = ["Beach", "Mountain", "City", "Luxury", "Budget", "Heritage", "Forest", "Countryside", "Island", "Desert"];
  res.render("listings/edit", { listing, genres });
};

module.exports.updateListing = async (req, res) => {
  const { id } = req.params;
  const listing = await Listing.findById(id);

  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  const prevLocation = listing.location;
  const prevCountry = listing.country;

  // Apply text field updates
  Object.assign(listing, req.body.listing);

  // Update image if new file uploaded
  if (req.file?.path && req.file?.filename) {
    if (listing.image?.filename && listing.image.filename !== DEFAULT_IMAGE.filename) {
      try { await cloudinary.uploader.destroy(listing.image.filename); } catch { }
    }
    listing.image = { url: req.file.path, filename: req.file.filename };
  }

  // Re-geocode only when the address changed, or when the stored point is
  // still the approximate fallback (gives failed lookups a second chance).
  const addressChanged =
    listing.location !== prevLocation || listing.country !== prevCountry;

  if (addressChanged || listing.geometry?.isApproximate !== false) {
    listing.geometry = await geocodeSafe(listing.location, listing.country);
  }

  await listing.save();

  if (listing.geometry?.isApproximate) {
    req.flash(
      "success",
      "Listing updated! The map still shows an approximate location — try a more specific location name."
    );
  } else {
    req.flash("success", "Listing updated!");
  }
  res.redirect(`/listings/${id}`);
};

module.exports.deleteListing = async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) {
    req.flash("error", "Listing not found!");
    return res.redirect("/listings");
  }

  if (listing.image?.filename && listing.image.filename !== DEFAULT_IMAGE.filename) {
    try { await cloudinary.uploader.destroy(listing.image.filename); } catch { }
  }

  await Listing.findByIdAndDelete(req.params.id);
  req.flash("success", "Listing deleted!");
  res.redirect("/listings");
};
