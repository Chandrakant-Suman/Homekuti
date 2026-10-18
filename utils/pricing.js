// Single source of truth for booking prices. The listing page and checkout
// mirror this formula for display, but the server always recomputes it.

const BASE_GUESTS = 2;        // nightly price covers this many guests
const MAX_GUESTS = 4;
const SERVICE_FEE = 20;               // flat ₹ per booking (no GST on it)
const DEFAULT_EXTRA_GUEST_PERCENT = 20;

// GST on accommodation, by price charged per night (rates from 22 Sept 2025):
// up to ₹7,500 → 5%, above → 18%
const GST_SLAB_LIMIT = 7500;
const GST_RATE_LOW = 5;
const GST_RATE_HIGH = 18;
const gstRateFor = tariffPerNight => (tariffPerNight <= GST_SLAB_LIMIT ? GST_RATE_LOW : GST_RATE_HIGH);

function computePrice(listing, nights, guests) {
  const pricePerNight = listing.price;
  const extraGuestPercent = listing.extraGuestPercent ?? DEFAULT_EXTRA_GUEST_PERCENT;
  const extraGuests = Math.max(0, guests - BASE_GUESTS);
  const extraGuestFeePerNight = Math.round(pricePerNight * extraGuestPercent / 100);

  const baseTotal = pricePerNight * nights;
  const extraGuestTotal = extraGuestFeePerNight * extraGuests * nights;
  const subtotal = baseTotal + extraGuestTotal;

  // Slab uses what the guest pays per night, including extra-guest charges
  const tariffPerNight = pricePerNight + extraGuestFeePerNight * extraGuests;
  const gstRate = gstRateFor(tariffPerNight);
  const gst = Math.round(subtotal * gstRate / 100);
  const serviceFee = SERVICE_FEE;

  return {
    pricePerNight,
    nights,
    guests,
    baseGuests: BASE_GUESTS,
    extraGuests,
    extraGuestPercent,
    extraGuestFeePerNight,
    baseTotal,
    extraGuestTotal,
    subtotal,
    tariffPerNight,
    gstRate,
    gst,
    serviceFee,
    grandTotal: subtotal + gst + serviceFee,
  };
}

const GENDERS = ["male", "female", "other", "prefer_not_to_say"];

/**
 * Validate and normalise the per-guest details sent from checkout.
 * Returns { guests } on success or { error } with a user-facing message.
 */
function validateGuestDetails(raw, expectedCount) {
  if (!Array.isArray(raw) || raw.length !== expectedCount) {
    return { error: `Please enter details for all ${expectedCount} guest(s).` };
  }
  const guests = [];
  for (let i = 0; i < raw.length; i++) {
    const g = raw[i] || {};
    const label = `Guest ${i + 1}`;
    const name = typeof g.name === "string" ? g.name.trim() : "";
    const age = Number(g.age);
    const gender = typeof g.gender === "string" ? g.gender : "";

    if (name.length < 2 || name.length > 60) return { error: `${label}: name must be 2–60 characters.` };
    if (!Number.isInteger(age) || age < 0 || age > 120) return { error: `${label}: enter a valid age (0–120).` };
    if (!GENDERS.includes(gender)) return { error: `${label}: please select a gender.` };
    guests.push({ name, age, gender });
  }
  if (!guests.some(g => g.age >= 18)) {
    return { error: "At least one guest must be 18 or older." };
  }
  return { guests };
}

module.exports = {
  BASE_GUESTS,
  MAX_GUESTS,
  SERVICE_FEE,
  GST_SLAB_LIMIT,
  GST_RATE_LOW,
  GST_RATE_HIGH,
  GENDERS,
  computePrice,
  validateGuestDetails,
};
