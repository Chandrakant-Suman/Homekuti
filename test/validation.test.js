const test = require("node:test");
const assert = require("node:assert/strict");
const { isProtectedAdmin, protectedEmailRegex, PROTECTED_ADMIN_EMAIL } = require("../utils/protectedAdmin");
const { validateListing } = require("../middlewares/validateListing");

test("primary admin is matched case- and whitespace-insensitively", () => {
  assert.ok(isProtectedAdmin({ email: PROTECTED_ADMIN_EMAIL }));
  assert.ok(isProtectedAdmin({ email: `  ${PROTECTED_ADMIN_EMAIL.toUpperCase()} ` }));
  assert.ok(!isProtectedAdmin({ email: "someone@example.com" }));
  assert.ok(!isProtectedAdmin(null));
  assert.ok(protectedEmailRegex().test(PROTECTED_ADMIN_EMAIL.toUpperCase()));
  assert.ok(!protectedEmailRegex().test(`x${PROTECTED_ADMIN_EMAIL}`));
});

function runValidator(listing) {
  let passed = false;
  try {
    validateListing({ body: { listing } }, {}, () => { passed = true; });
  } catch (err) {
    return err;
  }
  return passed ? null : new Error("next() not called");
}

const valid = {
  title: "Sea View Villa",
  description: "A quiet villa by the beach.",
  price: 2500,
  location: "Goa",
  country: "India",
  extraGuestPercent: 20,
};

test("listing validation accepts a valid listing", () => {
  assert.equal(runValidator(valid), null);
});

test("listing validation rejects bad price and out-of-range extra-guest %", () => {
  assert.ok(runValidator({ ...valid, price: 0 }));
  assert.ok(runValidator({ ...valid, extraGuestPercent: 150 }));
  assert.ok(runValidator({ ...valid, title: "" }));
});
