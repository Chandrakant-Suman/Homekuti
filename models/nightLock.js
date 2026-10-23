const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/*
 * One document per (listing, night) that is held or booked.
 *
 * The unique index makes double booking impossible at the database level:
 * when two checkouts race for the same night, exactly one insert succeeds.
 *
 *   hold   → created at checkout with expiresAt (TTL index deletes it if unpaid)
 *   booked → after payment: booking set, expiresAt removed (never expires)
 *   freed  → deleted on cancellation / host-unavailable / listing deletion
 */
const nightLockSchema = new Schema({
  listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
  night: { type: Date, required: true },          // UTC midnight of the night's date
  holdId: { type: Schema.Types.ObjectId, required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  booking: { type: Schema.Types.ObjectId, ref: "Booking" },
  expiresAt: { type: Date },                      // only set while it's an unpaid hold
});

nightLockSchema.index({ listing: 1, night: 1 }, { unique: true });
nightLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
nightLockSchema.index({ holdId: 1 });
nightLockSchema.index({ booking: 1 });

module.exports = mongoose.model("NightLock", nightLockSchema);
