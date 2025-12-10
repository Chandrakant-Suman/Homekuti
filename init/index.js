const mongoose = require('mongoose');
const initData = require('./data.js');
const Listing = require('../models/listing.js');

const MONGO_URL = 'mongodb://127.0.0.1:27017/Homekuti';

main()
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.log('Error connecting to MongoDB:', err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  try {
    // Clear existing listings
    await Listing.deleteMany({});

    // Normalize image -> always a string URL
    const normalizedData = initData.data.map((item) => {
      let image = item.image;

      if (image && typeof image === 'object') {
        // case: { filename: 'listingimage', url: 'https://...' }
        image = image.url;
      }

      // if still falsy, let schema default handle empty string
      if (!image) {
        image = '';
      }

      return {
        ...item,
        image, // overwrite with string
      };
    });

    await Listing.insertMany(normalizedData);
    console.log('data was initialized');
  } catch (err) {
    console.error('Error while initializing data:', err);
  } finally {
    // optional: close connection after seeding
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

initDB();
