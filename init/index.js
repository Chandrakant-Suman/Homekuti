require("dotenv").config();

const mongoose = require("mongoose");

// All four models are needed: listings are re-seeded, and reviews/bookings
// must be cleared alongside them or they end up pointing at deleted listings.
const Listing = require("../models/listing");
const User    = require("../models/user");
const Review  = require("../models/review");
const Booking = require("../models/booking");

const { data: sampleListings } = require("./data");

// Prefer the cloud URI, fall back to local. Matches app.js so the seed
// script and the app can never disagree about which database they use.
const MONGO_URL = process.env.ATLASDB_URL || process.env.MONGO_URI;

// One source of truth for the admin username — the lookup and the
// creation branch must agree, or the script searches for one user
// and silently creates a different one.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || "homekuti247@gmail.com";

const RESET = process.env.RESET_DB === "true";

const initDB = async () => {
  if (!MONGO_URL) {
    console.error("❌ No database URI. Set ATLASDB_URL or MONGO_URI in .env");
    process.exit(1);
  }

  if (!process.env.ADMIN_PASSWORD) {
    console.error("❌ ADMIN_PASSWORD is not set in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URL);

    // Say out loud which database is about to be modified. This line is the
    // difference between reseeding your dev data and wiping the live site.
    const isLocal = MONGO_URL.includes("127.0.0.1") || MONGO_URL.includes("localhost");
    console.log(`✓ Connected — target: ${isLocal ? "LOCAL" : "REMOTE (Atlas)"}`);
    console.log(`  Database: ${mongoose.connection.name}`);

    if (RESET) {
      // Order matters only for readability; these are independent collections.
      //
      // NOTE: deleteMany() does NOT fire the post("findOneAndDelete") hook on
      // listingSchema, so reviews are not cascaded automatically here — they
      // have to be deleted explicitly or they linger forever, unreferenced.
      await Listing.deleteMany({});
      await Review.deleteMany({});
      await Booking.deleteMany({});

      // Users survive a reset (you don't want to delete your own admin), but
      // their embedded ID arrays would now point at deleted documents.
      await User.updateMany({}, { $set: { wishlist: [], bookings: [] } });

      console.log("✓ Cleared listings, reviews, bookings; reset user references");
    }

    // ── Seed owner ────────────────────────────────────────────────
    // Find-or-create. An existing admin is reused so a reset never
    // locks you out of the account you log in with.
    let owner = await User.findOne({ username: ADMIN_USERNAME });

    if (!owner) {
      owner = new User({
        username: ADMIN_USERNAME,
        email:    ADMIN_EMAIL,
        role:     "admin",
      });

      // register() hashes the password via passport-local-mongoose (PBKDF2
      // + per-user salt) and saves. Never store or log the plaintext.
      await User.register(owner, process.env.ADMIN_PASSWORD);
      console.log(`✓ Created admin user: ${ADMIN_USERNAME}`);
    } else {
      console.log(`✓ Using existing admin: ${owner.username} (role: ${owner.role})`);
    }

    // ── Listings ──────────────────────────────────────────────────
    // Guard against duplicates: without RESET_DB=true, running this twice
    // would insert a second copy of every sample listing.
    const existingCount = await Listing.countDocuments();

    if (existingCount > 0 && !RESET) {
      console.log(`⚠️  ${existingCount} listings already exist — skipping insert.`);
      console.log("    Run with RESET_DB=true to wipe and reseed.");
    } else {
      const listingsWithOwner = sampleListings.map((l) => ({
        ...l,
        owner: owner._id,
      }));

      const inserted = await Listing.insertMany(listingsWithOwner);
      console.log(`✓ Seeded ${inserted.length} listings`);
    }

    console.log("\n🎉 Database initialized successfully!");
    console.log(`   Admin login: ${ADMIN_USERNAME}`);

    await mongoose.connection.close();
    process.exit(0);

  } catch (err) {
    // Exit non-zero so a failed seed is visibly a failure. The previous
    // version exited 0 from a finally block, which reported success even
    // after the listings had already been deleted.
    console.error("❌ Seed error:", err);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

initDB();