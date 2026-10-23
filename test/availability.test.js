// Concurrency tests for date locking. These need a real MongoDB because the
// guarantee comes from the database's unique index; they're skipped unless
// TEST_MONGO_URI points at a throwaway database (CI sets this).
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const NightLock = require("../models/nightLock");
const {
  nightsBetween, checkAvailability, getAvailability, acquireHold, confirmBooking, releaseBooking,
  DatesUnavailableError, HOLD_MINUTES,
} = require("../utils/availability");

const d = s => new Date(`${s}T00:00:00Z`);
const id = () => new mongoose.Types.ObjectId();

test("nightsBetween lists each night, excluding the check-out day", () => {
  assert.deepEqual(nightsBetween(d("2027-01-10"), d("2027-01-13")).map(n => n.toISOString().slice(0, 10)),
    ["2027-01-10", "2027-01-11", "2027-01-12"]);
  assert.equal(nightsBetween(d("2027-01-10"), d("2027-01-10")).length, 0);
});

const DB = process.env.TEST_MONGO_URI;

test("date locking against a real database", { skip: !DB && "set TEST_MONGO_URI to run" }, async t => {
  await mongoose.connect(DB);
  await mongoose.connection.db.dropDatabase();
  await NightLock.init(); // build the unique + TTL indexes before racing
  t.after(async () => {
    await mongoose.connection.db.dropDatabase();
    await mongoose.disconnect();
  });

  await t.test("10 simultaneous checkouts for the same dates: exactly one wins", async () => {
    const listingId = id();
    const results = await Promise.allSettled(Array.from({ length: 10 }, () =>
      acquireHold({ listingId, userId: id(), checkIn: d("2027-02-01"), checkOut: d("2027-02-04") })));
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    for (const r of results.filter(r => r.status === "rejected")) {
      assert.ok(r.reason instanceof DatesUnavailableError);
    }
    // the winner holds all 3 nights, nobody holds a partial range
    assert.equal(await NightLock.countDocuments({ listing: listingId }), 3);
  });

  await t.test("partially overlapping stays racing: only one succeeds", async () => {
    const listingId = id();
    const results = await Promise.allSettled([
      acquireHold({ listingId, userId: id(), checkIn: d("2027-03-01"), checkOut: d("2027-03-05") }),
      acquireHold({ listingId, userId: id(), checkIn: d("2027-03-04"), checkOut: d("2027-03-08") }),
    ]);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  });

  await t.test("back-to-back stays (check-out day = next check-in) both succeed", async () => {
    const listingId = id();
    await acquireHold({ listingId, userId: id(), checkIn: d("2027-04-01"), checkOut: d("2027-04-03") });
    await acquireHold({ listingId, userId: id(), checkIn: d("2027-04-03"), checkOut: d("2027-04-05") });
    assert.equal(await NightLock.countDocuments({ listing: listingId }), 4);
  });

  await t.test("an expired hold does not block other guests", async () => {
    const listingId = id();
    const first = await acquireHold({ listingId, userId: id(), checkIn: d("2027-05-01"), checkOut: d("2027-05-02") });
    await NightLock.updateMany({ holdId: first.holdId }, { expiresAt: new Date(Date.now() - 1000) });
    await acquireHold({ listingId, userId: id(), checkIn: d("2027-05-01"), checkOut: d("2027-05-02") });
  });

  await t.test("a guest re-opening checkout replaces their own hold", async () => {
    const listingId = id(), userId = id();
    await acquireHold({ listingId, userId, checkIn: d("2027-06-01"), checkOut: d("2027-06-03") });
    await acquireHold({ listingId, userId, checkIn: d("2027-06-01"), checkOut: d("2027-06-03") });
    assert.equal(await NightLock.countDocuments({ listing: listingId }), 2);
    // and the read check ignores their own hold but not for others
    assert.equal(await checkAvailability(listingId, d("2027-06-01"), d("2027-06-03"), userId), true);
    assert.equal(await checkAvailability(listingId, d("2027-06-01"), d("2027-06-03"), id()), false);
  });

  await t.test("an unpaid hold reports 'held' with when it frees up; paid reports 'booked'", async () => {
    const listingId = id(), userId = id(), bookingId = id();
    const { holdId, expiresAt } = await acquireHold({ listingId, userId, checkIn: d("2027-09-01"), checkOut: d("2027-09-03") });
    assert.equal(Math.round((expiresAt - Date.now()) / 60000), HOLD_MINUTES);

    const held = await getAvailability(listingId, d("2027-09-02"), d("2027-09-04"), id());
    assert.equal(held.reason, "held");
    assert.equal(held.retryInMinutes, HOLD_MINUTES);
    assert.match(held.message, new RegExp(`${HOLD_MINUTES} minutes`));

    // a second guest racing for it gets the same "try again in N minutes" message
    await assert.rejects(
      acquireHold({ listingId, userId: id(), checkIn: d("2027-09-02"), checkOut: d("2027-09-04") }),
      err => err instanceof DatesUnavailableError && /free up in about/.test(err.message));

    await confirmBooking({ holdId, bookingId, listingId, userId, checkIn: d("2027-09-01"), checkOut: d("2027-09-03") });
    const booked = await getAvailability(listingId, d("2027-09-02"), d("2027-09-04"), id());
    assert.equal(booked.reason, "booked");
    assert.match(booked.message, /already booked/);
  });

  await t.test("paying confirms the hold permanently; cancelling frees the dates", async () => {
    const listingId = id(), userId = id(), bookingId = id();
    const { holdId } = await acquireHold({ listingId, userId, checkIn: d("2027-07-01"), checkOut: d("2027-07-03") });
    await confirmBooking({ holdId, bookingId, listingId, userId, checkIn: d("2027-07-01"), checkOut: d("2027-07-03") });
    assert.equal(await NightLock.countDocuments({ booking: bookingId, expiresAt: { $exists: false } }), 2);
    await assert.rejects(
      acquireHold({ listingId, userId: id(), checkIn: d("2027-07-02"), checkOut: d("2027-07-04") }),
      DatesUnavailableError);

    await releaseBooking(bookingId);
    assert.equal(await checkAvailability(listingId, d("2027-07-01"), d("2027-07-03")), true);
  });

  await t.test("payment after an expired hold whose dates were taken is rejected, not double-booked", async () => {
    const listingId = id(), slowUser = id();
    const slow = await acquireHold({ listingId, userId: slowUser, checkIn: d("2027-08-01"), checkOut: d("2027-08-03") });
    await NightLock.updateMany({ holdId: slow.holdId }, { expiresAt: new Date(Date.now() - 1000) });

    const fastBooking = id(), fastUser = id();
    const fast = await acquireHold({ listingId, userId: fastUser, checkIn: d("2027-08-02"), checkOut: d("2027-08-04") });
    await confirmBooking({ holdId: fast.holdId, bookingId: fastBooking, listingId, userId: fastUser,
      checkIn: d("2027-08-02"), checkOut: d("2027-08-04") });

    await assert.rejects(
      confirmBooking({ holdId: slow.holdId, bookingId: id(), listingId, userId: slowUser,
        checkIn: d("2027-08-01"), checkOut: d("2027-08-03") }),
      DatesUnavailableError);
    // the fast guest's booking is untouched and the slow guest holds nothing
    assert.equal(await NightLock.countDocuments({ booking: fastBooking }), 2);
    assert.equal(await NightLock.countDocuments({ holdId: slow.holdId }), 0);
  });
});
