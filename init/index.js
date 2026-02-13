require("dotenv").config();

const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const MONGO_URL = process.env.MONGO_URI;

if (!MONGO_URL) {
  throw new Error("MONGO_URI is missing in .env");
}

const OWNER_ID = new mongoose.Types.ObjectId(
  process.env.ADMIN_OBJECT_ID
);

main()
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Mongo error:", err));

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  try {

    if (process.env.NODE_ENV !== "development") {
      throw new Error("Seeding blocked outside development mode");
    }

    await Listing.deleteMany({});

    const normalizedData = initData.data.map((item) => ({
      ...item,
      owner: OWNER_ID,
      image: {
        url: item.image.url,
        filename: item.image.filename,
      },
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
