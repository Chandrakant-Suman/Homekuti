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
    let owner = await User.findOne({ username: "homekuti_admin" });
    if (!owner) {
      owner = new User({ username: "homekuti_admin", email: "admin@homekuti.com", role: "admin" });
      await User.register(owner, "Admin@1234");
      console.log("✓ Created admin user: homekuti_admin / Admin@1234");
    }

    // Insert listings
    const listingsWithOwner = sampleListings.map(l => ({ ...l, owner: owner._id }));
    const inserted = await Listing.insertMany(listingsWithOwner);
    console.log(`✓ Seeded ${inserted.length} listings`);

    console.log("\n🎉 Database initialized successfully!");
    console.log("   Admin login: homekuti_admin / Admin@1234");
  } catch (err) {
    console.error("❌ Seed error:", err);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

initDB();
