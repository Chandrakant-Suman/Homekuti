// utils/geocoding.js - Using LocationIQ Geocoding API with longer timeout

const axios = require("axios");

const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;

/**
 * Geocode a location using LocationIQ
 * @param {string} location - Location string (e.g., "Paris, France")
 * @returns {Promise<Object>} - { coordinates: [lng, lat], isDefault: boolean }
 */
async function geocodeLocation(location) {
  try {
    if (!LOCATIONIQ_API_KEY) {
      console.error("⚠️  LOCATIONIQ_API_KEY not found in environment variables");
      return getDefaultCoordinates();
    }

    // LocationIQ Search API endpoint
    const url = `https://us1.locationiq.com/v1/search.php`;

    const response = await axios.get(url, {
      params: {
        key: LOCATIONIQ_API_KEY,
        q: location,
        format: "json",
        limit: 1,
      },
      timeout: 10000, // ✅ Increased to 10 seconds (was 5 seconds)
    });

    // Check if we got results
    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);

      console.log(`✓ Geocoded: "${location}" → [${lng}, ${lat}]`);

      return {
        coordinates: [lng, lat], // GeoJSON format: [longitude, latitude]
        isDefault: false,
      };
    } else {
      // No results found - return default coordinates
      console.warn(`⚠️  Geocoding failed for "${location}" - using default coordinates`);
      return getDefaultCoordinates();
    }
  } catch (error) {
    if (error.response) {
      // LocationIQ API error
      console.error("LocationIQ API error:", error.response.data);
      if (error.response.status === 401) {
        console.error("❌ Invalid LocationIQ API key");
      } else if (error.response.status === 429) {
        console.error("❌ LocationIQ rate limit exceeded");
      }
    } else if (error.code === 'ECONNABORTED') {
      // Timeout error
      console.error("❌ Geocoding timeout - request took too long");
    } else {
      console.error("Geocoding error:", error.message);
    }
    // Return default coordinates on error
    return getDefaultCoordinates();
  }
}

/**
 * Get default coordinates (center of India)
 * @returns {Object} - { coordinates: [lng, lat], isDefault: true }
 */
function getDefaultCoordinates() {
  return {
    coordinates: [78.9629, 20.5937], // Center of India [lng, lat]
    isDefault: true,
  };
}

/**
 * Reverse geocode coordinates to get location name using LocationIQ
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string>} - Location name
 */
async function reverseGeocode(lat, lng) {
  try {
    if (!LOCATIONIQ_API_KEY) {
      console.error("⚠️  LOCATIONIQ_API_KEY not found");
      return "Unknown location";
    }

    const url = `https://us1.locationiq.com/v1/reverse.php`;

    const response = await axios.get(url, {
      params: {
        key: LOCATIONIQ_API_KEY,
        lat: lat,
        lon: lng,
        format: "json",
      },
      timeout: 10000, // ✅ Increased to 10 seconds
    });

    if (response.data && response.data.display_name) {
      return response.data.display_name;
    }

    return "Unknown location";
  } catch (error) {
    console.error("Reverse geocoding error:", error.message);
    return "Unknown location";
  }
}

module.exports = {
  geocodeLocation,
  reverseGeocode,
  getDefaultCoordinates,
};