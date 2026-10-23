const Booking = require("../models/booking");

/*
 * Booking status moves forward with time:
 *   upcoming ──(check-in date reached)──► active ──(check-out date reached)──► completed
 * Cancelled / unavailable bookings never move.
 *
 * Render's free tier sleeps, so a timer alone isn't reliable. syncBookingStatuses()
 * therefore runs at startup, on an interval while awake, and (throttled) right
 * before any page that depends on status, e.g. "My bookings" or review eligibility.
 */

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;   // throttle for on-demand syncs

/** Status a booking should have at `now` (pure; used for display and tests). */
function effectiveStatus(booking, now = new Date()) {
  if (!["upcoming", "active"].includes(booking.status)) return booking.status;
  if (now >= booking.checkOut) return "completed";
  if (now >= booking.checkIn) return "active";
  return "upcoming";
}

/** Bulk-advance every booking whose dates have passed. Idempotent. */
async function syncBookingStatuses(now = new Date()) {
  const [toActive, toCompleted] = await Promise.all([
    Booking.updateMany(
      { status: "upcoming", checkIn: { $lte: now }, checkOut: { $gt: now } },
      { $set: { status: "active" } }
    ),
    Booking.updateMany(
      { status: { $in: ["upcoming", "active"] }, checkOut: { $lte: now } },
      { $set: { status: "completed", completedAt: now } }
    ),
  ]);
  return { activated: toActive.modifiedCount, completed: toCompleted.modifiedCount };
}

let lastSync = 0;
let inFlight = null;

/** Throttled sync for request paths; never throws (status display must not break pages). */
async function ensureFreshStatuses() {
  if (Date.now() - lastSync < MIN_GAP_MS) return inFlight;
  lastSync = Date.now();
  inFlight = syncBookingStatuses().catch(err => {
    lastSync = 0;   // retry on the next request
    console.error("Booking status sync failed:", err.message);
  });
  return inFlight;
}

// Express middleware form
const freshStatuses = (req, res, next) => ensureFreshStatuses().then(() => next(), next);

function startStatusScheduler() {
  ensureFreshStatuses();
  const timer = setInterval(ensureFreshStatuses, SYNC_INTERVAL_MS);
  timer.unref();   // don't keep the process alive just for this
}

module.exports = { effectiveStatus, syncBookingStatuses, ensureFreshStatuses, freshStatuses, startStatusScheduler };
