require("dotenv").config();

const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const MONGO_URL = `mongodb://${process.env.MONGODB_URI}`;

const OWNER_ID = new mongoose.Types.ObjectId(
  `${process.env.ADMIN_OBJECT_ID}`
);

main()
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Mongo error:", err));

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  try {
    await Listing.deleteMany({});

    const normalizedData = initData.data.map((item) => ({
      ...item,
      owner: OWNER_ID,
      image: item.image   // ✅ KEEP OBJECT
    }));

    await Listing.insertMany(normalizedData);

    console.log("Database seeded successfully");
  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

initDB();
