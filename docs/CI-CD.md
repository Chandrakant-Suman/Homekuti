# CI/CD

Pipeline: `.github/workflows/ci-cd.yml` (GitHub Actions)

```
push / pull request ──► CI: install → check → unit tests → smoke test
                                        │
                     (only pushes to main, only if CI passed)
                                        ▼
                  CD: trigger Render deploy → wait until /healthz serves this commit
```

## What runs

| Step | Command | What it catches |
|---|---|---|
| Install | `npm ci` | Exact versions from `package-lock.json` |
| Static checks | `npm run check` | JS syntax errors in any file, EJS templates that don't compile |
| Tests | `npm test` | Unit: pricing / GST, refunds, sign-up rules, verification rules. DB (needs `TEST_MONGO_URI`): double-booking races, booking lifecycle, verified reviews, and route authorization: who can view, cancel, edit, review and administer what (`test/`) |
| Smoke test | `npm run smoke` | App boots against a throwaway MongoDB; key pages return the right status |
| Audit | `npm audit` | Known vulnerable dependencies (informational, never blocks) |
| Deploy | Render deploy hook | Only on `main`, only after all of the above pass |
| Verify | `GET /healthz` | Waits until Render serves the new commit with the database up |

CI uses its own MongoDB container. It never connects to Atlas or needs production secrets.

## One-time setup

1. **Render → your service → Settings → Deploy Hook**: copy the URL.
2. **GitHub → repo → Settings → Secrets and variables → Actions → New repository secret**:
   `RENDER_DEPLOY_HOOK_URL` = the hook URL. (Treat it like a password: anyone with it can trigger deploys.)
3. *(Optional)* same page → **Variables** tab: `APP_URL` = your site URL if it isn't `https://homekuti.onrender.com`.
4. **Render → Settings → Build & Deploy → Auto-Deploy: Off.** Otherwise Render deploys every push itself,
   even when tests fail, and you get two deploys per push.
5. **Render → Settings → Build Command**: `npm ci` (uses the committed lockfile, same as CI).
6. *(Recommended)* **GitHub → Settings → Branches → Add rule for `main`**: require the
   **"Check, test & smoke"** status check to pass before merging pull requests.

## Day-to-day

- Work on a branch, open a pull request → CI runs; merge only when it's green.
- Push or merge to `main` → CI runs, then deploys automatically.
- See runs under the repo's **Actions** tab. A red ✗ shows which step failed and its log.
- Re-run manually: **Actions → CI/CD → Run workflow**.

## Run the same checks locally

```bash
npm run check
npm test
```

Database tests are skipped unless `TEST_MONGO_URI` points at a scratch database. Each test file
uses its own database (suffix `_locks`, `_lifecycle`, `_authz`) and deletes it when done:

```bash
TEST_MONGO_URI="mongodb://127.0.0.1:27017/homekuti_test" npm test
```

The smoke test needs a scratch database and refuses to run without one:

```bash
SMOKE_MONGO_URI="mongodb://127.0.0.1:27017/homekuti_smoke" npm run smoke
```

## Health endpoint

`GET /healthz` → `200 {"status":"ok","db":"up","commit":"<git sha>","uptime":123}`,
or `503` when the database is down. Safe to use for uptime monitors (e.g. UptimeRobot), which also
keeps a free Render instance from sleeping.
