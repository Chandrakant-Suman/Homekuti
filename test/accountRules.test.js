const test = require("node:test");
const assert = require("node:assert/strict");
const { validateSignup, passwordProblem, normalizeEmail, isEmailVerified } = require("../utils/accountRules");

const good = { username: "asha_rao", email: "Asha@Example.com ", password: "goaTrip2026" };

test("valid sign-up passes and the email is normalised", () => {
  const { values, errors } = validateSignup(good);
  assert.deepEqual(errors, {});
  assert.equal(values.email, "asha@example.com");
});

test("username rules: 3–30 letters/numbers/._ only", () => {
  assert.ok(validateSignup({ ...good, username: "ab" }).errors.username);
  assert.ok(validateSignup({ ...good, username: "has space" }).errors.username);
  assert.ok(validateSignup({ ...good, username: "x".repeat(31) }).errors.username);
  assert.ok(validateSignup({ ...good, username: "<script>" }).errors.username);
});

test("email must look like an address", () => {
  for (const email of ["", "asha", "asha@", "asha@example", "a b@example.com"]) {
    assert.ok(validateSignup({ ...good, email }).errors.email, email);
  }
});

test("password needs 8+ chars with a letter and a number", () => {
  assert.match(passwordProblem("short1"), /at least 8/);
  assert.match(passwordProblem("onlyletters"), /letter and one number/);
  assert.match(passwordProblem("12345678"), /letter and one number/);
  assert.match(passwordProblem("a1".repeat(65)), /at most/);
  assert.equal(passwordProblem("goaTrip2026"), null);
  assert.match(passwordProblem(undefined), /at least 8/);
});

test("non-string input is rejected, not crashed on", () => {
  const { errors } = validateSignup({ username: ["x"], email: { $ne: "" }, password: 12345678 });
  assert.ok(errors.username && errors.email && errors.password);
  assert.equal(normalizeEmail({ $gt: "" }), "");
});

test("only accounts explicitly marked unverified are unverified", () => {
  assert.equal(isEmailVerified({ emailVerified: false }), false);
  assert.equal(isEmailVerified({ emailVerified: true }), true);
  assert.equal(isEmailVerified({}), true);          // created before the feature
  assert.equal(isEmailVerified(null), false);
});
