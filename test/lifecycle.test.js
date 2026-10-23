// Booking lifecycle + verified-review eligibility. DB parts run when
// TEST_MONGO_URI points at a throwaway database (CI sets this).
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Booking = require("../models/booking");
const Review = require("../models/review");
const { effectiveStatus, syncBookingStatuses } = require("../utils/bookingLifecycle");
const { getReviewEligibility } = require("../utils/reviewEligibility");

const DAY = 86400000;
const NOW = new Date("2027-03-10T12:00:00Z");
const at = days => new Date(NOW.getTime() + days * DAY);

test("effectiveStatus follows the stay dates", () => {
  const b = (ci, co, status = "upcoming") => ({ status, checkIn: at(ci), checkOut: at(co) });
  assert.equal(effectiveStatus(b(2, 4), NOW), "upcoming");
  assert.equal(effectiveStatus(b(-1, 1), NOW), "active");
  assert.equal(effectiveStatus(b(-3, -1), NOW), "completed");
  assert.equal(effectiveStatus(b(-1, 1, "active"), at(2)), "completed");
  // cancelled / unavailable never move
  assert.equal(effectiveStatus(b(-3, -1, "cancelled"), NOW), "cancelled");
  assert.equal(effectiveStatus(b(-3, -1, "unavailable"), NOW), "unavailable");
});

const DB = process.env.TEST_MONGO_URI && process.env.TEST_MONGO_URI.replace(/(\/[^/?]*)(\?|$)/, "$1_lifecycle$2");

test("lifecycle and reviews against a real database", { skip: !DB && "set TEST_MONGO_URI to run" }, async t => {
  await mongoose.connect(DB);
  await mongoose.connection.db.dropDatabase();
  await Review.init();   // build the one-review-per-stay unique index
  t.after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  });

  const id = () => new mongoose.Types.ObjectId();
  const guest = { _id: id() }, host = { _id: id() };
  const listing = { _id: id(), owner: host._id };
  const insert = (ci, co, status = "upcoming", user = guest) => Booking.create({
    user: user._id, listing: listing._id, checkIn: at(ci), checkOut: at(co),
    guests: 2, nights: co - ci, totalPrice: 1000, paymentStatus: "paid", status,
  });

  await t.test("sync moves bookings forward and leaves cancelled ones alone", async () => {
    const future = await insert(5, 7);
    const ongoing = await insert(-1, 1);
    const past = await insert(-5, -3);
    const cancelled = await insert(-5, -3, "cancelled");

    const res = await syncBookingStatuses(NOW);
    assert.deepEqual(res, { activated: 1, completed: 1 });
    const status = async b => (await Booking.findById(b._id)).status;
    assert.equal(await status(future), "upcoming");
    assert.equal(await status(ongoing), "active");
    assert.equal(await status(past), "completed");
    assert.equal(await status(cancelled), "cancelled");
    assert.ok((await Booking.findById(past._id)).completedAt);

    // idempotent
    assert.deepEqual(await syncBookingStatuses(NOW), { activated: 0, completed: 0 });
    await Booking.deleteMany({});
  });

  await t.test("only a guest with a completed stay can review, once per stay", async () => {
    let e = await getReviewEligibility(host, listing);
    assert.equal(e.reason, "owner");

    e = await getReviewEligibility(guest, listing);
    assert.equal(e.reason, "no_stay");

    await insert(5, 7);                        // upcoming stay doesn't count
    e = await getReviewEligibility(guest, listing);
    assert.equal(e.reason, "no_stay");

    const stay = await insert(-5, -3, "completed");
    e = await getReviewEligibility(guest, listing);
    assert.equal(e.eligible, true);
    assert.equal(String(e.booking._id), String(stay._id));

    await Review.create({ rating: 5, comment: "Lovely", author: guest._id, listing: listing._id, booking: stay._id });
    e = await getReviewEligibility(guest, listing);
    assert.equal(e.reason, "already_reviewed");

    // the database itself rejects a second review for the same stay
    await assert.rejects(
      Review.create({ rating: 1, comment: "Again", author: guest._id, listing: listing._id, booking: stay._id }),
      err => err.code === 11000);

    // a second, later completed stay can be reviewed separately
    const stay2 = await insert(-2, -1, "completed");
    e = await getReviewEligibility(guest, listing);
    assert.equal(String(e.booking._id), String(stay2._id));
  });

  await t.test("reviews written before the feature (no booking) don't collide", async () => {
    await Review.create({ rating: 4, comment: "old one", author: id() });
    await Review.create({ rating: 3, comment: "old two", author: id() });
    assert.equal(await Review.countDocuments({ booking: { $exists: false } }), 2);
  });
});
