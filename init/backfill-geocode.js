// init/backfill-geocode.js
//
// Re-geocodes listings that are stuck on the fallback (centre of India)
// coordinates — i.e. every listing created while geocoding was failing.
//
//   node init/backfill-geocode.js          # fix only the broken ones
//   FORCE=true node init/backfill-geocode.js   # re-geocode every listing
//
// Nominatim asks for ≤1 request/second, so requests are spaced out.

require("dotenv").config();

const mongoose = require("mongoose");
const Listing = require("../models/listing");
const { geocodeToGeometry, isDefaultCoordinates } = require("../utils/geocoding");

const MONGO_URL = process.env.ATLASDB_URL || process.env.MONGO_URI;
const FORCE = process.env.FORCE === "true";
const DELAY_MS = 1100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!MONGO_URL) {
    console.error("❌ No database URI. Set ATLASDB_URL or MONGO_URI in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URL);
    console.log(`✓ Connected — database: ${mongoose.connection.name}`);

    const listings = await Listing.find({});
    const targets = FORCE
      ? listings
      : listings.filter(
          (l) =>
            l.geometry?.isApproximate === true ||
            !Array.isArray(l.geometry?.coordinates) ||
            l.geometry.coordinates.length !== 2 ||
            isDefaultCoordinates(l.geometry.coordinates)
        );

    console.log(
      `Found ${targets.length} listing(s) to geocode out of ${listings.length}.`
    );

    let fixed = 0;
    let stillApprox = 0;

    for (const listing of targets) {
      const geometry = await geocodeToGeometry(listing.location, listing.country);
      listing.geometry = geometry;
      await listing.save();

      if (geometry.isApproximate) {
        stillApprox++;
        console.log(`  ✗ ${listing.title} — "${listing.location}, ${listing.country}" not found`);
      } else {
        fixed++;
        console.log(`  ✓ ${listing.title} → [${geometry.coordinates.join(", ")}]`);
      }

      await sleep(DELAY_MS);
    }

    console.log(`\n🎉 Done. Fixed: ${fixed}. Still approximate: ${stillApprox}.`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Backfill error:", err);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
})();
