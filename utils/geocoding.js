// utils/geocoding.js
// Resolves a free-text location to [lng, lat].
//
// Why this is written defensively: a single provider + a single query string
// meant that ANY hiccup (bad/expired key, rate limit, timeout, an
// unrecognised "Area, City" string) silently produced the centre-of-India
// fallback, so every new listing rendered the same default map.
//
// Strategy: try several query variants against several providers, in order,
// and only fall back to the default when every attempt has failed.

const axios = require("axios");

const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;
const APP_NAME = process.env.APP_NAME || "Homekuti";
const CONTACT = process.env.ADMIN_EMAIL || "support@homekuti.app";
const USER_AGENT = `${APP_NAME}/1.0 (${CONTACT})`;

const TIMEOUT = 8000;

// Centre of India — only used when everything else fails.
const DEFAULT_COORDINATES = [78.9629, 20.5937];

const isValidCoords = ([lng, lat]) =>
  Number.isFinite(lng) &&
  Number.isFinite(lat) &&
  lng >= -180 &&
  lng <= 180 &&
  lat >= -90 &&
  lat <= 90 &&
  !(lng === 0 && lat === 0);

/* ────────────────────────────────────────────────
   Providers — each returns [lng, lat] or null
   ──────────────────────────────────────────────── */

async function fromLocationIQ(query) {
  if (!LOCATIONIQ_API_KEY) return null;

  const { data } = await axios.get("https://us1.locationiq.com/v1/search.php", {
    params: { key: LOCATIONIQ_API_KEY, q: query, format: "json", limit: 1 },
    timeout: TIMEOUT,
  });

  if (!Array.isArray(data) || !data.length) return null;
  return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
}

// OpenStreetMap Nominatim — free, no key. Requires an identifying User-Agent.
async function fromNominatim(query) {
  const { data } = await axios.get("https://nominatim.openstreetmap.org/search", {
    params: { q: query, format: "json", limit: 1 },
    timeout: TIMEOUT,
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
  });

  if (!Array.isArray(data) || !data.length) return null;
  return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
}

// Photon (Komoot) — free, no key, tolerant of messy input.
async function fromPhoton(query) {
  const { data } = await axios.get("https://photon.komoot.io/api", {
    params: { q: query, limit: 1 },
    timeout: TIMEOUT,
    headers: { "User-Agent": USER_AGENT },
  });

  const hit = data?.features?.[0]?.geometry?.coordinates; // already [lng, lat]
  if (!Array.isArray(hit) || hit.length < 2) return null;
  return [Number(hit[0]), Number(hit[1])];
}

const PROVIDERS = [
  { name: "locationiq", fn: fromLocationIQ, enabled: !!LOCATIONIQ_API_KEY },
  { name: "nominatim", fn: fromNominatim, enabled: true },
  { name: "photon", fn: fromPhoton, enabled: true },
];

/* ────────────────────────────────────────────────
   Query variants — broadest match wins over nothing
   ──────────────────────────────────────────────── */

function buildQueries(location = "", country = "") {
  const loc = String(location || "").trim();
  const ctry = String(country || "").trim();

  const variants = [];
  if (loc && ctry) variants.push(`${loc}, ${ctry}`);
  if (loc) variants.push(loc);

  // "Baga Beach, North Goa" → drop the leading detail and retry with "North Goa"
  if (loc.includes(",")) {
    const parts = loc.split(",").map((p) => p.trim()).filter(Boolean);
    for (let i = 1; i < parts.length; i++) {
      const tail = parts.slice(i).join(", ");
      if (ctry) variants.push(`${tail}, ${ctry}`);
      variants.push(tail);
    }
  }

  if (ctry) variants.push(ctry); // last resort: at least the right country

  return [...new Set(variants)].filter(Boolean);
}

/* ────────────────────────────────────────────────
   Public API
   ──────────────────────────────────────────────── */

/**
 * Geocode a location.
 * @param {string} location
 * @param {string} [country] - optional; `location` may also be a full "City, Country" string
 * @returns {Promise<{coordinates: [number, number], isDefault: boolean, source: string, query: string|null}>}
 */
async function geocodeLocation(location, country = "") {
  const queries = buildQueries(location, country);

  if (!queries.length) {
    console.warn("⚠️  Geocoding skipped — empty location");
    return getDefaultCoordinates();
  }

  for (const query of queries) {
    for (const provider of PROVIDERS) {
      if (!provider.enabled) continue;

      try {
        const coords = await provider.fn(query);

        if (coords && isValidCoords(coords)) {
          console.log(
            `✓ Geocoded "${query}" → [${coords[0]}, ${coords[1]}] via ${provider.name}`
          );
          return {
            coordinates: coords,
            isDefault: false,
            source: provider.name,
            query,
          };
        }
      } catch (error) {
        const status = error.response?.status;
        if (status === 401 || status === 403) {
          console.error(`❌ ${provider.name}: invalid/unauthorised API key`);
          provider.enabled = false; // don't retry a dead key for every variant
        } else if (status === 429) {
          console.error(`❌ ${provider.name}: rate limit exceeded`);
        } else if (error.code === "ECONNABORTED") {
          console.error(`❌ ${provider.name}: timeout on "${query}"`);
        } else {
          console.error(`❌ ${provider.name}: ${error.message}`);
        }
      }
    }
  }

  console.warn(
    `⚠️  All geocoding attempts failed for "${queries[0]}" — using default coordinates`
  );
  return getDefaultCoordinates();
}

/**
 * Fallback coordinates (centre of India).
 */
function getDefaultCoordinates() {
  return {
    coordinates: [...DEFAULT_COORDINATES],
    isDefault: true,
    source: "default",
    query: null,
  };
}

/**
 * Geocode and return a ready-to-save GeoJSON Point.
 * Never throws — callers can await it inline.
 */
async function geocodeToGeometry(location, country) {
  let result;
  try {
    result = await geocodeLocation(location, country);
  } catch (err) {
    console.error("Geocoding error:", err.message);
    result = getDefaultCoordinates();
  }

  return {
    type: "Point",
    coordinates: result.coordinates,
    isApproximate: result.isDefault,
  };
}

const isDefaultCoordinates = (coords) =>
  Array.isArray(coords) &&
  coords[0] === DEFAULT_COORDINATES[0] &&
  coords[1] === DEFAULT_COORDINATES[1];

module.exports = {
  geocodeLocation,
  geocodeToGeometry,
  getDefaultCoordinates,
  isDefaultCoordinates,
  DEFAULT_COORDINATES,
};
