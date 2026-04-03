const Listing = require("../models/listing");
const User = require("../models/user");
const { geocodeLocation } = require("../utils/geocoding");
const { cloudinary } = require("../cloudConfig");

const DEFAULT_IMAGE = {
  url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1771003245/Homekuti_DEV/kzjbrisg2uqssvvp99a3.jpg",
  filename: "Homekuti_DEV/kzjbrisg2uqssvvp99a3",
};

async function geocodeSafe(location, country) {
  try {
    const geoData = await geocodeLocation(`${location}, ${country}`);
    return geoData?.coordinates
      ? { type: "Point", coordinates: geoData.coordinates }
      : { type: "Point", coordinates: [78.9629, 20.5937] };
  } catch {
    return { type: "Point", coordinates: [78.9629, 20.5937] };
  }
}

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

  const [lng, lat] = listing.geometry?.coordinates || [78.9629, 20.5937];
  const isDefaultLocation = lng === 78.9629 && lat === 20.5937;
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

  req.flash("success", "New listing created successfully!");
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

  // Apply text field updates
  Object.assign(listing, req.body.listing);

  // Update image if new file uploaded
  if (req.file?.path && req.file?.filename) {
    if (listing.image?.filename && listing.image.filename !== DEFAULT_IMAGE.filename) {
      try { await cloudinary.uploader.destroy(listing.image.filename); } catch { }
    }
    listing.image = { url: req.file.path, filename: req.file.filename };
  }

  listing.geometry = await geocodeSafe(listing.location, listing.country);

  await listing.save();
  req.flash("success", "Listing updated!");
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
