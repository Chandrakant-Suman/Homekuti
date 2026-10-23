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

const CHECKS = [
  { path: "/healthz", status: 200, json: body => body.db === "up" },
  { path: "/", status: 200 },
  { path: "/listings", status: 200 },
  { path: "/user/signin", status: 200 },
  { path: "/user/forgot-password", status: 200 },
  { path: "/about", status: 200 },
  { path: "/this-route-does-not-exist", status: 404 },
  { path: "/admin/dashboard", status: 302 }, // protected: redirects to sign-in
];

const app = spawn(process.execPath, [path.join(__dirname, "..", "app.js")], {
  env: {
    ...process.env,
    // Set both so a local .env (loaded by dotenv, which never overrides) can't redirect the app
    ATLASDB_URL: DB_URI,
    MONGO_URI: DB_URI,
    PORT: String(PORT),
    SESSION_SECRET: process.env.SESSION_SECRET || "smoke-test-secret",
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
  if (failed) throw new Error(`${failed} smoke check(s) failed`);
  console.log("✓ Smoke test passed");
}

main()
  .then(() => { app.kill(); process.exit(0); })
  .catch(err => {
    console.error(`✗ ${err.message}\n──── app output ────\n${logs.slice(-4000)}`);
    app.kill();
    process.exit(1);
  });
