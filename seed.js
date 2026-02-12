const mongoose = require("mongoose");
const Listing = require("./models/listing");
const { data: sampleListings } = require("./init/data");

mongoose.connect("mongodb://127.0.0.1:27017/Homekuti");

const initDB = async () => {

  // 🔥 VERY IMPORTANT — remove old listings
  await Listing.deleteMany({});

  const ownerId = "697eedc0ca93151c7775c697"; // your existing user

  const listings = sampleListings.map((obj) => ({
    ...obj,
    owner: ownerId
  }));

  await Listing.insertMany(listings);

  console.log("Database seeded successfully!");
};

initDB().then(() => mongoose.connection.close());
