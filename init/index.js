// ================= SEED SCRIPT FOR MONGODB ATLAS =================
// This script populates MongoDB Atlas with listings from data.js
require("dotenv").config();
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");

// Get MongoDB Atlas URL from .env
const dbUrl = process.env.ATLASDB_URL;

if (!dbUrl) {
  console.error("❌ Error: ATLASDB_URL is missing in .env file");
  process.exit(1);
}

// Database connection
async function connectDB() {
  try {
    await mongoose.connect(dbUrl);
    console.log("✓ Connected to MongoDB Atlas");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

// Get or create admin user
async function getAdminUser() {
  try {
    // If ADMIN_OBJECT_ID is provided in .env, use it
    if (process.env.ADMIN_OBJECT_ID) {
      const userId = new mongoose.Types.ObjectId(process.env.ADMIN_OBJECT_ID);
      const user = await User.findById(userId);
      
      if (user) {
        console.log(`✓ Using existing user: ${user.username} (${userId})`);
        return userId;
      } else {
        console.log("⚠️  ADMIN_OBJECT_ID not found in database");
      }
    }

    // Check if seed admin user already exists
    let adminUser = await User.findOne({ username: "seedadmin" });
    
    if (adminUser) {
      console.log(`✓ Using existing seed admin: ${adminUser.username} (${adminUser._id})`);
      return adminUser._id;
    }

    // Create new seed admin user
    console.log("\n👤 Creating seed admin user...");
    adminUser = new User({
      email: "seedadmin@homekuti.com",
      username: "seedadmin"
    });
    
    await User.register(adminUser, "seedadmin123"); // Password: seedadmin123
    console.log(`✓ Created seed admin user: ${adminUser.username} (${adminUser._id})`);
    console.log("   Email: seedadmin@homekuti.com");
    console.log("   Password: seedadmin123");
    
    return adminUser._id;

  } catch (err) {
    console.error("❌ Error getting/creating admin user:", err);
    // If all else fails, create a new ObjectId
    const newId = new mongoose.Types.ObjectId();
    console.log(`⚠️  Using auto-generated ObjectId: ${newId}`);
    return newId;
  }
}

// Main seeding function
const initDB = async () => {
  try {
    // Connect to database
    await connectDB();

    // Optional: Uncomment to block seeding in production
    // if (process.env.NODE_ENV === "production") {
    //   throw new Error("⚠️  Seeding blocked in production mode for safety");
    // }

    // Get owner ID (same for all listings)
    const OWNER_ID = await getAdminUser();

    // Delete existing listings
    console.log("\n🗑️  Deleting existing listings...");
    const deleteResult = await Listing.deleteMany({});
    console.log(`✓ Deleted ${deleteResult.deletedCount} existing listings`);

    // Prepare data with owner
    console.log("\n📝 Preparing listings data...");
    const normalizedData = initData.data.map((item) => ({
      ...item,
      owner: OWNER_ID, // ← SAME owner for ALL listings
      image: {
        url: item.image.url,
        filename: item.image.filename,
      },
    }));

    console.log(`✓ Prepared ${normalizedData.length} listings`);
    console.log(`✓ All listings will have owner ID: ${OWNER_ID}`);

    // Insert listings into database
    console.log("\n💾 Inserting listings into MongoDB Atlas...");
    const insertResult = await Listing.insertMany(normalizedData);
    console.log(`✓ Successfully inserted ${insertResult.length} listings`);

    // Verify all have same owner
    const uniqueOwners = [...new Set(insertResult.map(l => l.owner.toString()))];
    console.log(`✓ Verified: All listings have the same owner (${uniqueOwners.length} unique owner)`);

    // Summary
    console.log("\n🎉 Database seeded successfully!");
    console.log("\n📊 Summary:");
    console.log(`   Total listings: ${insertResult.length}`);
    console.log(`   Owner ID: ${OWNER_ID}`);
    console.log(`   Unique owners: ${uniqueOwners.length} (should be 1)`);
    console.log(`   Locations: ${[...new Set(normalizedData.map(l => l.location))].join(", ")}`);
    console.log(`   Price range: ₹${Math.min(...normalizedData.map(l => l.price))} - ₹${Math.max(...normalizedData.map(l => l.price))}`);

  } catch (err) {
    console.error("\n❌ Seeding failed:", err.message);
    console.error(err);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log("\n✓ MongoDB connection closed");
    process.exit(0);
  }
};

// Run the seeding function
initDB();