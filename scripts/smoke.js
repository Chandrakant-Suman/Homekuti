// Boot the real app and hit key routes (npm run smoke).
// Runs ONLY against an explicit throwaway database so it can never touch
// production data: CI provides MONGO_URI (a service container); locally set
// SMOKE_MONGO_URI to a scratch database.
const { spawn } = require("child_process");
const path = require("path");

const DB_URI = process.env.SMOKE_MONGO_URI || (process.env.CI === "true" ? process.env.MONGO_URI : null);
if (!DB_URI) {
  console.error("✗ Refusing to run: set SMOKE_MONGO_URI to a throwaway database (CI sets this up automatically).");
  process.exit(1);
}

const PORT = process.env.SMOKE_PORT || 4010;
const BASE = `http://127.0.0.1:${PORT}`;
const BOOT_TIMEOUT_MS = 45000;
const WEBHOOK_SECRET = "smoke-webhook-secret";

const CHECKS = [
  { path: "/healthz", status: 200, json: body => body.db === "up" },
  { path: "/", status: 200 },
  { path: "/listings", status: 200 },
  { path: "/user/signin", status: 200 },
  { path: "/user/forgot-password", status: 200 },
  { path: "/about", status: 200 },
  { path: "/this-route-does-not-exist", status: 404 },
  { path: "/admin/dashboard", status: 302 }, // protected: redirects to sign-in
  { path: "/listings/000000000000000000000000/availability?checkIn=2030-01-01&checkOut=2030-01-02", status: 404 },
];

const app = spawn(process.execPath, [path.join(__dirname, "..", "app.js")], {
  env: {
    ...process.env,
    // Set both so a local .env (loaded by dotenv, which never overrides) can't redirect the app
    ATLASDB_URL: DB_URI,
    MONGO_URI: DB_URI,
    PORT: String(PORT),
    SESSION_SECRET: process.env.SESSION_SECRET || "smoke-test-secret",
    RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    // Console mailer: no real emails, and the verification link appears in the logs
    SMTP_HOST: "",
    BREVO_API_KEY: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
app.stdout.on("data", d => (logs += d));
app.stderr.on("data", d => (logs += d));

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForHealthy() {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (app.exitCode !== null) throw new Error(`App exited early with code ${app.exitCode}`);
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.status === 200) return;
    } catch { /* not listening yet */ }
    await sleep(500);
  }
  throw new Error(`App not healthy within ${BOOT_TIMEOUT_MS / 1000}s`);
}

async function main() {
  await waitForHealthy();
  let failed = 0;
  for (const c of CHECKS) {
    const res = await fetch(BASE + c.path, { redirect: "manual" });
    let ok = res.status === c.status;
    if (ok && c.json) ok = c.json(await res.json());
    console.log(`${ok ? "✓" : "✗"} GET ${c.path} → ${res.status} (expected ${c.status})`);
    if (!ok) failed++;
  }
  failed += await securityChecks();
  failed += await accountChecks();
  if (failed) throw new Error(`${failed} smoke check(s) failed`);
  console.log("✓ Smoke test passed");
}

// Regression checks for security fixes (Group A)
async function securityChecks() {
  let failed = 0;
  const check = (ok, label) => { console.log(`${ok ? "✓" : "✗"} ${label}`); if (!ok) failed++; };
  const form = body => ({
    method: "POST", redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });

  // Unsafe booking delete route and debug routes are gone
  let res = await fetch(`${BASE}/bookings/000000000000000000000000?_method=DELETE`, form({}));
  check(res.status === 404, `DELETE /bookings/:id removed → ${res.status}`);
  res = await fetch(`${BASE}/test/session`);
  check(res.status === 404, `/test/session removed → ${res.status}`);

  // Webhook: valid signature over the raw body accepted, tampered body rejected
  const crypto = require("crypto");
  const raw = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_smoke" } } } });
  const sign = b => crypto.createHmac("sha256", WEBHOOK_SECRET).update(b).digest("hex");
  const hook = (body, sig) => fetch(`${BASE}/bookings/webhook`, {
    method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": sig }, body,
  });
  res = await hook(raw, sign(raw));
  check(res.status === 200, `webhook with valid signature → ${res.status}`);
  res = await hook(raw.replace("smoke", "evil"), sign(raw));
  check(res.status === 400, `webhook with tampered body → ${res.status}`);

  // Sign-in rate limit: 10 failed attempts allowed, the 11th is blocked
  let last;
  for (let i = 0; i < 11; i++) {
    last = await fetch(`${BASE}/user/signin`, form({ username: "nobody-smoke", password: "wrong" }));
  }
  const header = last.headers.get("ratelimit") || "";
  check(/remaining=0/.test(header), `11th failed sign-in is rate limited (RateLimit: ${header || "none"})`);

  return failed;
}

// Sign-up validation and email verification (Group B)
async function accountChecks() {
  let failed = 0;
  const check = (ok, label) => { console.log(`${ok ? "✓" : "✗"} ${label}`); if (!ok) failed++; };
  let cookie = "";
  const req = async (path, opts = {}) => {
    const res = await fetch(BASE + path, {
      redirect: "manual", ...opts, headers: { ...(opts.headers || {}), cookie },
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return res;
  };
  const post = (path, body) => req(path, {
    method: "POST", body: new URLSearchParams(body),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });

  let res = await post("/user/signup", { username: "a", email: "nope", password: "short" });
  let html = await res.text();
  check(res.status === 422 && /3–30 characters/.test(html) && /valid email/.test(html),
    `invalid sign-up shows field errors → ${res.status}`);

  res = await post("/user/signup", { username: "smoke_user", email: "Smoke.User@Example.com", password: "smokeTest123" });
  check(res.status === 302, `valid sign-up → ${res.status}`);

  res = await req("/listings/new");
  check(res.status === 302 && res.headers.get("location") === "/user/profile",
    `unverified user can't host → ${res.status} ${res.headers.get("location")}`);
  res = await req("/api/payment/create-order", {
    method: "POST", body: "{}", headers: { "content-type": "application/json" },
  });
  check(res.status === 403, `unverified user can't start checkout → ${res.status}`);

  const link = (logs.match(/\/user\/verify-email\/([a-f0-9]{64})/g) || []).pop();
  check(Boolean(link), "verification email sent (console mailer)");
  if (link) {
    res = await req(link);
    check(res.status === 302, `verification link accepted → ${res.status}`);
    res = await req("/listings/new");
    check(res.status === 200, `verified user can host → ${res.status}`);
    res = await req(link);
    check(res.status === 302 && res.headers.get("location") !== "/listings", "used link can't be reused");
  }

  cookie = "";
  res = await post("/user/signup", { username: "smoke_user2", email: "SMOKE.USER@example.com", password: "smokeTest123" });
  html = await res.text();
  check(res.status === 422 && /already exists/.test(html), `duplicate email (different case) rejected → ${res.status}`);

  return failed;
}

main()
  .then(() => { app.kill(); process.exit(0); })
  .catch(err => {
    console.error(`✗ ${err.message}\n──── app output ────\n${logs.slice(-4000)}`);
    app.kill();
    process.exit(1);
  });
