const test = require("node:test");
const assert = require("node:assert/strict");
const Booking = require("../models/booking");

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-01T12:00:00+05:30");
const ID = "507f1f77bcf86cd799439011";

// In-memory document only; nothing touches a database
function booking(hoursUntilCheckIn, extra = {}) {
  const checkIn = new Date(NOW.getTime() + hoursUntilCheckIn * HOUR);
  return new Booking({
    user: ID,
    listing: ID,
    checkIn,
    checkOut: new Date(checkIn.getTime() + 24 * HOUR),
    guests: 2,
    nights: 1,
    totalPrice: 2330,
    priceBreakdown: { gst: 110, gstRate: 5, serviceFee: 20 },
    ...extra,
  });
}

test("refund tiers: ≥7 days 100%, 24h–7d 50%, <24h 0%, past 0%", () => {
  assert.equal(booking(24 * 8).getRefundPolicy(NOW).percentage, 100);
  assert.equal(booking(24 * 3).getRefundPolicy(NOW).percentage, 50);
  assert.equal(booking(5).getRefundPolicy(NOW).percentage, 0);
  assert.equal(booking(-5).getRefundPolicy(NOW).percentage, 0);
});

test("GST is not refunded when the guest cancels", () => {
  assert.equal(booking(24 * 8).getRefundAmount(NOW), 2330 - 110);
  assert.equal(booking(24 * 3).getRefundAmount(NOW), Math.round((2330 - 110) / 2));
  assert.equal(booking(5).getRefundAmount(NOW), 0);
});

test("older bookings without a GST record refund the full percentage", () => {
  const b = booking(24 * 8, { priceBreakdown: undefined });
  assert.equal(b.getRefundAmount(NOW), 2330);
});
