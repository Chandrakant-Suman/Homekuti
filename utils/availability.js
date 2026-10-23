const mongoose = require("mongoose");
const NightLock = require("../models/nightLock");
const Booking = require("../models/booking");

// How long a guest's dates stay reserved after clicking "Pay" (one place to change it)
const HOLD_MINUTES = 10;
const DAY_MS = 86400000;

const BOOKED_MESSAGE = "These dates are already booked. Please choose different dates.";
const heldMessage = minutes =>
  `Another guest is completing a booking for these dates. If they don't finish, ` +
  `the dates free up in about ${minutes} minute${minutes === 1 ? "" : "s"} — try again then, or pick other dates.`;

class DatesUnavailableError extends Error {
  constructor(message = BOOKED_MESSAGE) {
    super(message);
    this.name = "DatesUnavailableError";
    this.statusCode = 409;
  }
}

const isDuplicateKey = err =>
  err?.code === 11000 || err?.writeErrors?.some?.(e => e.code === 11000 || e.err?.code === 11000);

const utcMidnight = d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Every night of a stay: check-in date up to (not including) check-out date. */
function nightsBetween(checkIn, checkOut) {
  const nights = [];
  for (let t = utcMidnight(checkIn).getTime(); t < utcMidnight(checkOut).getTime(); t += DAY_MS) {
    nights.push(new Date(t));
  }
  return nights;
}

// Live = booked, or a hold that hasn't expired (TTL cleanup can lag ~60s)
const liveLockFilter = now => ({ $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] });

/**
 * Read-only availability check (listing page, checkout page, error messages).
 * `userId` lets a guest re-open checkout over their own unpaid hold.
 *
 * Returns one of:
 *   { available: true }
 *   { available: false, reason: "booked", message }
 *   { available: false, reason: "held", retryInMinutes, message }   ← only unpaid holds block
 */
async function getAvailability(listingId, checkIn, checkOut, userId = null) {
  const now = new Date();
  const nights = nightsBetween(checkIn, checkOut);

  const lockQuery = { listing: listingId, night: { $in: nights }, ...liveLockFilter(now) };
  if (userId) lockQuery.$nor = [{ user: userId, booking: { $exists: false } }];

  const [locks, legacy] = await Promise.all([
    NightLock.find(lockQuery).select("booking expiresAt").lean(),
    // Bookings made before night locks existed
    Booking.exists({
      listing: listingId,
      status: { $in: ["upcoming", "active"] },
      checkIn: { $lt: checkOut },
      checkOut: { $gt: checkIn },
    }),
  ]);

  if (legacy || locks.some(l => l.booking || !l.expiresAt)) {
    return { available: false, reason: "booked", message: BOOKED_MESSAGE };
  }
  if (locks.length) {
    // Free once the LAST blocking hold expires
    const lastExpiry = Math.max(...locks.map(l => l.expiresAt.getTime()));
    const retryInMinutes = Math.max(1, Math.ceil((lastExpiry - now.getTime()) / 60000));
    return { available: false, reason: "held", retryInMinutes, message: heldMessage(retryInMinutes) };
  }
  return { available: true };
}

async function checkAvailability(listingId, checkIn, checkOut, userId = null) {
  return (await getAvailability(listingId, checkIn, checkOut, userId)).available;
}

/**
 * Atomically hold every night for HOLD_MINUTES. Throws DatesUnavailableError
 * if any night is taken. All-or-nothing: a partial hold is rolled back.
 */
async function acquireHold({ listingId, userId, checkIn, checkOut }) {
  const now = new Date();
  const nights = nightsBetween(checkIn, checkOut);
  if (!nights.length) throw new DatesUnavailableError("Invalid dates.");

  // Clear dead holds on these nights, and this guest's own abandoned holds
  await NightLock.deleteMany({
    listing: listingId,
    booking: { $exists: false },
    $or: [{ night: { $in: nights }, expiresAt: { $lte: now } }, { user: userId }],
  });

  const holdId = new mongoose.Types.ObjectId();
  const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60000);
  try {
    await NightLock.insertMany(
      nights.map(night => ({ listing: listingId, night, holdId, user: userId, expiresAt })),
      { ordered: true }
    );
  } catch (err) {
    await NightLock.deleteMany({ holdId });
    if (isDuplicateKey(err)) {
      const status = await getAvailability(listingId, checkIn, checkOut, userId);
      throw new DatesUnavailableError(status.message || BOOKED_MESSAGE);
    }
    throw err;
  }
  return { holdId, expiresAt };
}

/**
 * Turn a hold into a permanent booking lock. If the hold expired and some
 * nights were taken meanwhile, rolls back and throws DatesUnavailableError.
 * Without a holdId (session lost), locks the nights directly.
 */
async function confirmBooking({ holdId, bookingId, listingId, userId, checkIn, checkOut }) {
  const nights = nightsBetween(checkIn, checkOut);
  const lockId = holdId || new mongoose.Types.ObjectId();

  if (holdId) {
    await NightLock.updateMany({ holdId }, { $set: { booking: bookingId }, $unset: { expiresAt: "" } });
  }
  const mine = await NightLock.find({ holdId: lockId }).select("night").lean();
  const have = new Set(mine.map(l => l.night.getTime()));
  const missing = nights.filter(n => !have.has(n.getTime()));
  if (!missing.length) return;

  try {
    // Expired dead holds on the missing nights don't count as taken
    await NightLock.deleteMany({
      listing: listingId, night: { $in: missing }, booking: { $exists: false }, expiresAt: { $lte: new Date() },
    });
    await NightLock.insertMany(
      missing.map(night => ({ listing: listingId, night, holdId: lockId, user: userId, booking: bookingId })),
      { ordered: true }
    );
  } catch (err) {
    await NightLock.deleteMany({ holdId: lockId });
    if (isDuplicateKey(err)) throw new DatesUnavailableError();
    throw err;
  }
}

const releaseHold = holdId => NightLock.deleteMany({ holdId, booking: { $exists: false } });
const releaseBooking = bookingId => NightLock.deleteMany({ booking: bookingId });
const releaseListing = listingId => NightLock.deleteMany({ listing: listingId });

module.exports = {
  HOLD_MINUTES,
  DatesUnavailableError,
  nightsBetween,
  getAvailability,
  checkAvailability,
  acquireHold,
  confirmBooking,
  releaseHold,
  releaseBooking,
  releaseListing,
};
