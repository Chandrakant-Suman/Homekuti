const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const MONGO_URL = "mongodb://127.0.0.1:27017/Homekuti";
const OWNER_ID = new mongoose.Types.ObjectId(
  "697eedc0ca93151c7775c697"
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
    const normalizedData = initData.data.map((item) => {
      let image = item.image;
      if (image && typeof image === "object") {
        image = image.url;
      }
      if (!image) image = "";
      return {
        ...item,
        image,
        owner: OWNER_ID
      };
    });

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
