const test = require("node:test");
const assert = require("node:assert/strict");
const Listing = require("../models/listing");
const { isVerified, statusOf, reverifyReasons, markPending } = require("../utils/verification");
const { validateListing } = require("../middlewares/validateListing");

const before = { title: "Sea View Villa", location: "Calangute, Goa", country: "India" };

test("new listings start as pending (shown as Not verified)", () => {
  const l = new Listing({ title: "x", price: 1, location: "y", country: "z", owner: "507f1f77bcf86cd799439011" });
  assert.equal(l.verification.status, "pending");
  assert.ok(l.verification.requestedAt instanceof Date);
  assert.equal(isVerified(l), false);
});

test("listings created before the feature (no status) count as pending", () => {
  assert.equal(statusOf({}), "pending");
  assert.equal(statusOf({ verification: {} }), "pending");
  assert.equal(statusOf({ verification: { status: "verified" } }), "verified");
});

test("changing title, location, country or photo requires re-verification", () => {
  assert.deepEqual(reverifyReasons(before, { ...before, title: "New name" }), ["title"]);
  assert.deepEqual(reverifyReasons(before, { ...before, location: "Baga, Goa" }), ["location"]);
  assert.deepEqual(reverifyReasons(before, before, true), ["photo"]);
});

test("price/description edits and whitespace-only changes keep the badge", () => {
  assert.deepEqual(reverifyReasons(before, { ...before, price: 9999, description: "new" }), []);
  assert.deepEqual(reverifyReasons(before, { ...before, title: "  Sea View Villa " }), []);
});

test("markPending resets a verified listing back into the queue", () => {
  const l = { verification: { status: "verified", reviewedBy: { username: "admin" } } };
  markPending(l, "Changed after verification: title");
  assert.equal(l.verification.status, "pending");
  assert.equal(l.verification.reviewedBy, undefined);
  assert.match(l.verification.note, /title/);
});

test("a host cannot set verification through the listing form", () => {
  const body = {
    listing: {
      title: "Sea View Villa", description: "A quiet villa by the beach.", price: 2500,
      location: "Goa", country: "India", verification: { status: "verified" },
    },
  };
  assert.throws(() => validateListing({ body }, {}, () => {}), /verification/);
});
