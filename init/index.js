require("dotenv").config();
const mongoose = require("mongoose");
const Listing = require("../models/listing");
const User = require("../models/user");
const { data: sampleListings } = require("./data");

const MONGO_URL = process.env.ATLASDB_URL;

const initDB = async () => {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("✓ Connected to MongoDB");

    if (process.env.RESET_DB === "true") {
      await Listing.deleteMany({});
      console.log("✓ Cleared existing listings");
    }

    // Find or create seed owner
    let owner = await User.findOne({ username: process.env.ADMIN_USERNAME || "admin" });
    if (!owner) {
      owner = new User({ username: "admin", email: "homekuti247@gmail.com", role: "admin" });
      await User.register(owner, process.env.ADMIN_PASSWORD);
      console.log("✓ Created admin user: admin / " + (process.env.ADMIN_PASSWORD));
    }

    // Insert listings
    const listingsWithOwner = sampleListings.map(l => ({ ...l, owner: owner._id }));
    const inserted = await Listing.insertMany(listingsWithOwner);
    console.log(`✓ Seeded ${inserted.length} listings`);

    console.log("\n🎉 Database initialized successfully!");
    console.log("   Admin login: admin");
  } catch (err) {
    console.error("❌ Seed error:", err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

initDB();
