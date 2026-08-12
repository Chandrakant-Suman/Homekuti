const Listing = require("../models/listing");
const User = require("../models/user");
const { geocodeToGeometry, isDefaultCoordinates } = require("../utils/geocoding");
const { cloudinary, fileToImage } = require("../cloudConfig");

const DEFAULT_IMAGE = {
  url: "https://res.cloudinary.com/dgu8te3bn/image/upload/v1771003245/Homekuti_DEV/kzjbrisg2uqssvvp99a3.jpg",
  filename: "Homekuti_DEV/kzjbrisg2uqssvvp99a3",
};

const GENRES = [
  "Beach", "Mountain", "City", "Luxury", "Budget",
  "Heritage", "Forest", "Countryside", "Island", "Desert",
];

const MAX_SEARCH_LENGTH = 100;

/**
 * Query params are not guaranteed to be strings: `?search=a&search=b` arrives
 * as an array and `?search[$ne]=x` as an object. Calling .trim() on either
 * threw a TypeError, so coerce to a plain string first.
 */
const asString = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : "";
  return "";
};

/**
 * Escape every regex metacharacter so the search term is matched literally.
 *
 * Previously the raw input was passed to `new RegExp()`, so a perfectly
 * reasonable search like "Villa (Goa)", "C++" or a half-typed "[" threw
 * `SyntaxError: Invalid regular expression` and returned a 500. Escaping also
 * closes off ReDoS — a crafted pattern like "(a+)+$" could otherwise pin the
 * event loop.
 */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Fields searched, in descending order of how much a hit there matters.
const SEARCH_FIELDS = [
  { name: "title", weight: 10 },
  { name: "location", weight: 6 },
  { name: "country", weight: 3 },
  { name: "description", weight: 1 },
];

const MAX_TOKENS = 8;

// Ignored as search words — matching every listing with "in" in its
// description is noise, not a result.
const STOP_WORDS = new Set([
  "a", "an", "and", "at", "by", "for", "in", "of", "on", "or",
  "the", "to", "with", "near",
]);

/**
 * Split a search string into usable words.
 *
 * "Villa (Goa)" → ["villa", "goa"], so a listing titled "Hillside Villa" or
 * one located in Goa both come back. Punctuation is a separator, not part of
 * the term. Single characters are dropped (a stray "(" shouldn't match
 * everything), and stop words are only removed when something else remains.
 */
const tokenize = (search) => {
  const words = search
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u) // split on anything that isn't a letter or digit
    .filter((w) => w.length > 1);

  const meaningful = words.filter((w) => !STOP_WORDS.has(w));

  // If the query was *only* stop words ("the"), search them rather than
  // silently returning everything.
  return (meaningful.length ? meaningful : words).slice(0, MAX_TOKENS);
};

/**
 * Score a listing against the search words.
 *
 * Each word is counted once per field, weighted by that field's importance,
 * so a listing matching both "villa" and "goa" in its title outranks one that
 * merely mentions Goa in its description. A whole-phrase hit gets a bonus so
 * exact matches stay on top, and matching more of the words beats matching one
 * of them repeatedly.
 */
const scoreListing = (listing, tokens, phrase) => {
  let score = 0;
  let matchedTokens = 0;

  for (const token of tokens) {
    let hit = false;

    for (const { name, weight } of SEARCH_FIELDS) {
      const value = listing[name];
      if (typeof value === "string" && value.toLowerCase().includes(token)) {
        score += weight;
        hit = true;
      }
    }

    if (hit) matchedTokens++;
  }

  // Coverage matters more than raw field weight: 2-of-2 words beats 1-of-2.
  score += matchedTokens * 25;

  if (phrase) {
    for (const { name, weight } of SEARCH_FIELDS) {
      const value = listing[name];
      if (typeof value === "string" && value.toLowerCase().includes(phrase)) {
        score += weight * 5;
      }
    }
  }

  return score;
};

// Resolves to a GeoJSON Point; never throws (see utils/geocoding.js)
const geocodeSafe = (location, country) => geocodeToGeometry(location, country);

/**
 * Delete a listing's image from Cloudinary, skipping the shared default (which
 * every listing without an upload points at — deleting it would blank them all).
 * Failures are logged, not thrown: a leftover file is not worth failing the
 * user's delete/update over.
 */
async function destroyImage(image) {
  const filename = image?.filename;
  if (!filename || filename === DEFAULT_IMAGE.filename) return;

  try {
    await cloudinary.uploader.destroy(filename);
  } catch (err) {
    console.error(`Cloudinary cleanup failed for "${filename}":`, err.message);
  }
}

module.exports.index = async (req, res) => {
  const search = asString(req.query.search).trim().slice(0, MAX_SEARCH_LENGTH);

  // Only accept a genre we actually offer; anything else is ignored rather
  // than passed through to the query.
  const requestedGenre = asString(req.query.genre).trim();
  const genre = GENRES.includes(requestedGenre) ? requestedGenre : "";

  const tokens = search ? tokenize(search) : [];
  const filter = {};

  if (tokens.length) {
    // Match ANY word in ANY field — "Villa Goa" should still find a villa
    // that happens to be in Kerala, just ranked lower than the Goa one.
    filter.$or = tokens.flatMap((token) => {
      const term = { $regex: escapeRegex(token), $options: "i" };
      return SEARCH_FIELDS.map(({ name }) => ({ [name]: term }));
    });
  }

  if (genre) {
    filter.genre = genre;
  }

  let allListings = await Listing.find(filter).lean();

  // Rank in the app rather than in Mongo: the OR query above is deliberately
  // broad, so relevance ordering is what keeps the results useful.
  if (tokens.length && allListings.length > 1) {
    const phrase = search.toLowerCase();

    allListings = allListings
      .map((listing) => ({
        listing,
        score: scoreListing(listing, tokens, tokens.length > 1 ? phrase : ""),
      }))
      .sort((a, b) => b.score - a.score || a.listing.title.localeCompare(b.listing.title))
      .map((entry) => entry.listing);
  }

  const viewData = {
    allListings,
    genres: GENRES,
    search,
    activeGenre: genre || "all",
  };

  // 🔥 AJAX request (for real-time search)
  if (req.xhr) {
    return res.render("listings/index", { ...viewData, layout: false });
  }

  res.render("listings/index", viewData);
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new", { genres: GENRES });
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

  // fileToImage() reads whichever field names the installed storage engine
  // uses; it returns null only when no usable file was uploaded.
  const uploaded = fileToImage(req.file);

  if (req.file && !uploaded) {
    console.warn("⚠️  Upload succeeded but no usable URL on req.file:", Object.keys(req.file));
  }

  newListing.image = uploaded || DEFAULT_IMAGE;

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
  res.render("listings/edit", { listing, genres: GENRES });
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

  // Update image if a new file was uploaded
  const uploaded = fileToImage(req.file);

  if (req.file && !uploaded) {
    console.warn("⚠️  Upload succeeded but no usable URL on req.file:", Object.keys(req.file));
  }

  if (uploaded) {
    await destroyImage(listing.image);
    listing.image = uploaded;
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

  await destroyImage(listing.image);

  await Listing.findByIdAndDelete(req.params.id);
  req.flash("success", "Listing deleted!");
  res.redirect("/listings");
};
