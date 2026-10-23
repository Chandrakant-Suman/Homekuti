const test = require("node:test");
const assert = require("node:assert/strict");
const { computePrice, validateGuestDetails, SERVICE_FEE } = require("../utils/pricing");

test("2 guests: no extra charge, 5% GST, flat service fee", () => {
  const p = computePrice({ price: 2200, extraGuestPercent: 20 }, 1, 2);
  assert.equal(p.extraGuestTotal, 0);
  assert.equal(p.gstRate, 5);
  assert.equal(p.gst, 110);
  assert.equal(p.serviceFee, SERVICE_FEE);
  assert.equal(p.grandTotal, 2200 + 110 + 20);
});

test("extra guests add the host's percentage per guest per night", () => {
  const p = computePrice({ price: 2000, extraGuestPercent: 20 }, 3, 4);
  assert.equal(p.extraGuests, 2);
  assert.equal(p.extraGuestFeePerNight, 400);
  assert.equal(p.extraGuestTotal, 400 * 2 * 3);
  assert.equal(p.subtotal, 6000 + 2400);
});

test("0% host charge means no extra-guest fee", () => {
  const p = computePrice({ price: 2000, extraGuestPercent: 0 }, 2, 4);
  assert.equal(p.extraGuestTotal, 0);
});

test("listings without the field default to 20%", () => {
  const p = computePrice({ price: 1000 }, 1, 3);
  assert.equal(p.extraGuestFeePerNight, 200);
});

test("GST slab: up to ₹7,500/night is 5%, above is 18%", () => {
  assert.equal(computePrice({ price: 7500 }, 1, 2).gstRate, 5);
  assert.equal(computePrice({ price: 7501 }, 1, 2).gstRate, 18);
});

test("GST slab uses the nightly tariff including extra guests", () => {
  // ₹7,000 + one extra guest at 20% = ₹8,400/night → 18%
  const p = computePrice({ price: 7000, extraGuestPercent: 20 }, 1, 3);
  assert.equal(p.tariffPerNight, 8400);
  assert.equal(p.gstRate, 18);
  assert.equal(p.gst, Math.round(8400 * 0.18));
});

test("guest details: valid input is normalised", () => {
  const r = validateGuestDetails(
    [{ name: "  Asha Rao ", age: "32", gender: "female" }, { name: "Ravi", age: 8, gender: "male" }],
    2
  );
  assert.deepEqual(r.guests, [
    { name: "Asha Rao", age: 32, gender: "female" },
    { name: "Ravi", age: 8, gender: "male" },
  ]);
});

test("guest details: rejects wrong count, bad values, and no adult", () => {
  const adult = { name: "Asha", age: 30, gender: "female" };
  assert.ok(validateGuestDetails([adult], 2).error);
  assert.ok(validateGuestDetails("not-an-array", 1).error);
  assert.ok(validateGuestDetails([{ ...adult, name: "A" }], 1).error);
  assert.ok(validateGuestDetails([{ ...adult, age: 130 }], 1).error);
  assert.ok(validateGuestDetails([{ ...adult, gender: "robot" }], 1).error);
  assert.match(validateGuestDetails([{ ...adult, age: 10 }], 1).error, /18 or older/);
});
