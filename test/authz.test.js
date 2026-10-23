// Route-level authorization tests: real HTTP requests through the whole app
// (sessions, middleware, controllers) as different signed-in users, asserting
// on database state. Runs when TEST_MONGO_URI points at a throwaway database.
const test = require("node:test");
const assert = require("node:assert/strict");

const RAW = process.env.TEST_MONGO_URI;
const DB = RAW && RAW.replace(/(\/[^/?]*)(\?|$)/, "$1_authz$2");

test("route authorization", { skip: !DB && "set TEST_MONGO_URI to run" }, async t => {
  // Configure before the app loads (dotenv never overrides existing vars)
  Object.assign(process.env, {
    ATLASDB_URL: DB, MONGO_URI: DB, NODE_ENV: "test",
    SESSION_SECRET: "authz-test-secret", SMTP_HOST: "", BREVO_API_KEY: "",
    PROTECTED_ADMIN_EMAIL: "primary-admin@test.local",
  });
  const request = require("supertest");
  const mongoose = require("mongoose");
  const app = require("../app");
  const User = require("../models/user");
  const Listing = require("../models/listing");
  const Booking = require("../models/booking");
  const Review = require("../models/review");

  await mongoose.connection.asPromise();
  await mongoose.connection.db.dropDatabase();
  await Promise.all([Review.init(), User.init()]);
  t.after(async () => {
    await mongoose.connection.db.dropDatabase();
    await app.locals.sessionStore.close();
    await mongoose.disconnect();
  });

  // ── Fixtures ───────────────────────────────────────────
  const PASSWORD = "testPass123";
  const mkUser = async (username, role = "user", email = `${username}@test.local`) =>
    User.register(new User({ username, email, role, emailVerified: true }), PASSWORD);

  const [guestA, guestB, host, admin, primary] = await Promise.all([
    mkUser("guest_a"), mkUser("guest_b"), mkUser("host_h", "owner"), mkUser("admin_x", "admin"),
    mkUser("primary_admin", "admin", "primary-admin@test.local"),
  ]);
  const listing = await Listing.create({
    title: "Host's Villa", description: "A lovely place to stay.", price: 2000,
    location: "Goa", country: "India", owner: host._id, verification: { status: "verified" },
  });
  const day = 86400000;
  const mkBooking = (user, extra = {}) => Booking.create({
    user: user._id, listing: listing._id,
    checkIn: new Date(Date.now() + 20 * day), checkOut: new Date(Date.now() + 22 * day),
    guests: 2, nights: 2, totalPrice: 4220, paymentStatus: "paid", status: "upcoming", ...extra,
  });
  const bookingB = await mkBooking(guestB);
  const review = await Review.create({ rating: 5, comment: "Great", author: guestB._id });
  listing.reviews.push(review._id);
  await listing.save();

  const signIn = async user => {
    const agent = request.agent(app);
    const res = await agent.post("/user/signin").type("form").send({ username: user.username, password: PASSWORD });
    assert.equal(res.headers.location, "/listings", `sign-in failed for ${user.username}`);
    return agent;
  };
  const [asA, asB, asHost, asAdmin] = await Promise.all([signIn(guestA), signIn(guestB), signIn(host), signIn(admin)]);
  const anon = request(app);
  const fresh = (Model, doc) => Model.findById(doc._id).lean();
  const listingForm = { "listing[title]": "Hijacked", "listing[description]": "Changed by someone else",
    "listing[price]": "1", "listing[location]": "Goa", "listing[country]": "India" };

  // ── Anonymous ──────────────────────────────────────────
  await t.test("signed-out users are sent to sign-in", async () => {
    for (const path of ["/bookings/my", "/listings/new", "/user/profile", "/admin/dashboard"]) {
      const res = await anon.get(path);
      assert.equal(res.status, 302, path);
      assert.equal(res.headers.location, "/user/signin", path);
    }
  });

  // ── Another guest's booking ────────────────────────────
  await t.test("a guest can't view or cancel someone else's booking", async () => {
    for (const path of [`/bookings/${bookingB._id}`, `/bookings/${bookingB._id}/cancel-preview`,
      `/api/payment/confirmation/${bookingB._id}`]) {
      const res = await asA.get(path);
      assert.equal(res.headers.location, "/bookings/my", path);
    }
    await asA.post(`/bookings/${bookingB._id}/cancel`).type("form").send({});
    assert.equal((await fresh(Booking, bookingB)).status, "upcoming");
  });

  await t.test("a guest can't mark someone else's booking unavailable", async () => {
    const res = await asA.post(`/bookings/${bookingB._id}/unavailable`).set("Referer", "/bookings/my");
    assert.equal(res.status, 302);
    assert.notEqual(res.headers.location, "back", "Express 5 has no 'back' redirect");
    assert.equal((await fresh(Booking, bookingB)).status, "upcoming");
  });

  await t.test("the booking's own guest can view it", async () => {
    const res = await asB.get(`/bookings/${bookingB._id}`);
    assert.equal(res.status, 200);
  });

  // ── Someone else's listing ─────────────────────────────
  await t.test("a non-owner can't edit, update or delete a listing", async () => {
    let res = await asA.get(`/listings/${listing._id}/edit`);
    assert.equal(res.headers.location, `/listings/${listing._id}`);
    await asA.put(`/listings/${listing._id}`).type("form").send(listingForm);
    await asA.delete(`/listings/${listing._id}`);
    const after = await fresh(Listing, listing);
    assert.ok(after, "listing still exists");
    assert.equal(after.title, "Host's Villa");
  });

  await t.test("a host can't self-verify through the listing form", async () => {
    const res = await asHost.put(`/listings/${listing._id}`).type("form")
      .send({ ...listingForm, "listing[title]": "Host's Villa", "listing[verification][status]": "verified" });
    assert.equal(res.status, 400);
  });

  await t.test("a host's title change sends a verified listing back for review", async () => {
    await asHost.put(`/listings/${listing._id}`).type("form").send({ ...listingForm, "listing[title]": "Renamed Villa" });
    const after = await fresh(Listing, listing);
    assert.equal(after.title, "Renamed Villa");
    assert.equal(after.verification.status, "pending");
  });

  await t.test("the host can mark a booking on their listing unavailable", async () => {
    const b = await mkBooking(guestA);
    const res = await asHost.post(`/bookings/${b._id}/unavailable`).set("Referer", "/bookings/my");
    assert.equal(res.status, 302);
    assert.notEqual(res.headers.location, "back");
    assert.equal((await fresh(Booking, b)).status, "unavailable");
  });

  // ── Reviews ────────────────────────────────────────────
  await t.test("reviews: no stay, no review; can't delete someone else's", async () => {
    await asA.post(`/listings/${listing._id}/reviews`).type("form")
      .send({ "review[rating]": "1", "review[comment]": "Never stayed here" });
    assert.equal(await Review.countDocuments({ author: guestA._id }), 0);

    await asA.delete(`/listings/${listing._id}/reviews/${review._id}`);
    assert.ok(await fresh(Review, review), "other guest's review survives");
  });

  // ── Admin-only actions ─────────────────────────────────
  await t.test("non-admins can't use admin pages or actions", async () => {
    const res = await asA.get("/admin/dashboard");
    assert.equal(res.headers.location, "/");

    await asHost.post(`/admin/listings/${listing._id}/verify`).type("form").send({ note: "self" });
    assert.notEqual((await fresh(Listing, listing)).verification.status, "verified");

    await asA.post(`/admin/users/${guestA._id}/role`).type("form").send({ role: "admin" });
    assert.equal((await fresh(User, guestA)).role, "user", "can't self-promote");

    await asA.post(`/bookings/${bookingB._id}/refund`).type("form").send({ amount: "4220" });
    assert.equal((await fresh(Booking, bookingB)).paymentStatus, "paid");
  });

  await t.test("admins can manage, but never demote or delete the primary admin", async () => {
    assert.equal((await asAdmin.get("/admin/dashboard")).status, 200);

    await asAdmin.post(`/admin/listings/${listing._id}/verify`).type("form").send({ note: "Visited" });
    assert.equal((await fresh(Listing, listing)).verification.status, "verified");

    await asAdmin.post(`/admin/users/${primary._id}/role`).type("form").send({ role: "owner" });
    await asAdmin.delete(`/admin/users/${primary._id}`);
    const p = await fresh(User, primary);
    assert.ok(p, "primary admin not deleted");
    assert.equal(p.role, "admin");
  });

  await t.test("the guest can cancel their own upcoming booking", async () => {
    await asB.post(`/bookings/${bookingB._id}/cancel`).type("form").send({ reason: "Plans changed" });
    assert.equal((await fresh(Booking, bookingB)).status, "cancelled");
  });
});

test("backTo only returns same-site paths", () => {
  const backTo = require("../utils/backTo");
  const req = ref => ({ protocol: "https", get: h => (h === "host" ? "homekuti.test" : ref) });
  assert.equal(backTo(req("https://homekuti.test/bookings/my?x=1")), "/bookings/my?x=1");
  assert.equal(backTo(req("https://evil.example/phish"), "/safe"), "/safe");
  assert.equal(backTo(req("//evil.example/phish"), "/safe"), "/safe");
  assert.equal(backTo(req("javascript:alert(1)"), "/safe"), "/safe");
  assert.equal(backTo(req(undefined), "/safe"), "/safe");
  assert.equal(backTo(req("::not a url::"), "/safe"), "/::not%20a%20url::");
});
