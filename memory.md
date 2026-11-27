# Aawan Jaawan — session handoff

Last updated: 2026-11-24 (Asia/Kolkata). Read this file when resuming and update it after meaningful changes. Never store credentials here.

## Product and user preferences

A beautiful, intuitive community travel board for people in Hyderabad with roots in Lucknow. Members ask who is travelling in either direction and voluntarily share itineraries. Preserve the warm ivory/deep-green design, city illustration, and familiar community tone.

User selected **Cloudflare Workers + D1** to avoid the Google Sheets setup and bought **aawanjaawan.fun** through Hostinger. They authorized deployment and domain connection. Google Sheets/Python integrations remain optional legacy backends, not production dependencies.

## Live deployment

- Primary URL: **https://aawanjaawan.fun**
- www redirects to apex: https://www.aawanjaawan.fun
- Temporary URL: https://aawanjaawan.aawanjaawan.workers.dev
- Latest user-confirmed production version: `94b5c37b-43e9-47d5-8219-495b4245c373`.
- Worker: `aawanjaawan`. D1 database: `aawanjaawan`; binding **DB**; UUID `3f8c69ef-b800-4680-bfa0-7194415424a3`.
- Hostinger registration remains in place. Cloudflare nameservers confirmed by screenshots: `deborah.ns.cloudflare.com`, `ken.ns.cloudflare.com`.
- Hostinger's imported apex A → `2.57.91.91` and www CNAME → apex conflicted with Worker custom domains; user removed them. Cloudflare subsequently confirmed both custom-domain triggers deployed.
- Provider deployment succeeded, but agent browser/live HTTP verification remains blocked. Do not represent that as a completed end-to-end test.
- Keep compatibility date **2026-11-01**; the original 2026-11-24 was rejected by provider as future-dated.

## Source and commands

- Frontend: `src/index.html`, `src/css/style.css`, `src/js/app.js`.
- Production handler/validation: `cloudflare/worker.mjs`; D1 schema: `cloudflare/migrations/0001_posts.sql`.
- `python3 build.py` generates `dist/`, `cloudflare/public/`, and the legacy Apps Script `Index.html`. Output folders are disposable and ignored.
- From root: `npm ci`, `npm ci --prefix cloudflare`, then `npm run dev` for local Worker/D1. Local test records are separate from production.
- Root verification: `npm test`, `npm run format:check`, `npm run check:deploy`.
- Deployment: `cd cloudflare && npm run deploy`. This rebuilds, dry-runs, migrates remotely, and publishes. `npm run launch` additionally verifies/provisions/reuses the database for first setup.
- `cloudflare/configure.py --database-id <actual UUID>` configures D1; `--enable-domain` adds custom-domain routes after activation.
- Production API: GET/POST `/api/posts`, GET `/api/health`. Worker serves assets and parameterized D1 queries. Health requires the binding and migrated table.
- `cloudflare/README.md` documents deployment/account/domain maintenance; root README is the public project overview.

## Behaviour to preserve

| Field | Find a traveller | Share your trip |
| --- | --- | --- |
| Date | Required Needed by deadline with on-or-before hint | Required actual travel date |
| Transport | Preferred transport, default Any mode | Flight, Train, Car, Not decided |
| Purpose | Find a traveller, A small parcel, Travel company, Other | Just sharing my trip, A small parcel, Travel company, Anything I can |
| Notes | Optional request details | Optional itinerary details |

- Name and WhatsApp required. Ten-digit Indian contacts normalize to +91; international numbers accept 10–15 digits.
- Route `lko` = Lucknow → Hyderabad; `hyd` = Hyderabad → Lucknow. Types `trip`/`request`; active/completed/cancelled statuses.
- Requests default to Find a traveller, trips to Just sharing my trip. Offering a favour is optional.
- Server assigns ID, timestamp, active status; India time controls expiry. Past/completed/cancelled records stay stored but do not list publicly.
- Form switching resets labels/options/defaults; request cards say By before the deadline. WhatsApp messages include direction and deadline/travel date.
- Shared save failures retain fields, do not falsely show success, and never silently fall back to local storage. In-flight duplicate clicks are blocked; stale refreshes cannot hide a new save.
- Saved IDs are personal browser data. All HTTP(S) visits use the shared API; file:// alone shows a labelled local demo.

## Review/cleanup completed in current work

User requested review, cleanup, a great README, commit and push.

- Replaced inherited HTML5 Boilerplate package metadata and obsolete Gulp/Webpack/template publication workflows. Original MIT attribution remains.
- Formatted frontend, Worker, and JS tests. Root commands now target the actual app.
- Added Linux-compatible Node frontend tests for localhost, production domain, workers.dev and the file demo; replaced upstream CI with actual app checks.
- Made generated assets reproducible, including favicon/robots, and removed misleading static prototype text.
- Added ignore rules for IDE settings, service registration, generated assets, personal Sheets config, local DB/logs/credentials. A stray `cloudflare/login` command scratch file stays local and ignored.
- Rewrote README/deployment guide around the live Cloudflare setup. Kept legacy backends documented separately.
- A local backup of removed upstream template files was written to `/private/tmp/aawanjaawan-template-before-cleanup.tar.gz`.
- Cleanup/source changes are **not yet deployed**; current production remains the last confirmed version above.

## Verification

Latest full suite: **5 native Node tests + 30 Python cases passed**, including 112 native Worker assertions, frontend behaviour checks on three hosts, and file-demo behaviour. Additional macOS JavaScriptCore suites contain 45 frontend, 101 legacy Sheets, and 112 simulated Worker assertions. Formatting check and Wrangler deploy dry-run passed. Temporary SQLite tests run the real D1 migration and listing SQL. A candidate-source credential-pattern scan found no matching files; logs/credentials/databases are excluded.

Node suites use simulated DOM/D1, not an actual browser. On non-macOS, JavaScriptCore suites skip but native Node frontend/Worker tests still run. No automated test writes production data. See `docs/REGRESSION-REVIEW.md` for historical review and manual checks.

## Git state / pending commit and push

- A Git repository now exists on branch **main**, but it had **no commits and no remotes** at review start. All intended source files were untracked.
- User supplied commit email **faizhusaini19@gmail.com**; use name **Faiz Husaini**. Do not alter global identity.
- Agent `git add .` failed with **.git/index.lock: Operation not permitted** because this session cannot write Git metadata. No commit or push has been completed.
- User has been asked for a repository URL; no URL has been supplied yet. Do not invent/create a remote silently.
- Prepared `scripts/publish.py`: run from a normal IntelliJ terminal with `python3 scripts/publish.py`. It uses an existing origin or prompts for an existing empty GitHub/GitLab URL, stages reviewed files, commits with the supplied per-command identity, then pushes the current branch without force. It does not deploy the website. Git authentication remains local; never request tokens in chat.
- Once the user provides a remote or runs publishing, verify actual commit SHA/push outcome before marking complete.

## Environment constraints and account access

- User successfully logged into Wrangler using device mode. Do not ask them to log in again without evidence of expiry.
- Node is available at `/Users/faizhusaini/Library/Application Support/JetBrains/IntelliJIdea2026.2/node/versions/26.13.0/bin/node`; prepend that directory to PATH for agent npm/Wrangler calls.
- Wrangler is installed in `cloudflare/node_modules`. Its normal logs are outside writable roots: set WRANGLER_LOG_PATH to project `.wrangler/` or /private/tmp and WRANGLER_SEND_METRICS=false.
- Agent API networking cannot resolve api.cloudflare.com/dash.cloudflare.com; user IntelliJ terminal works. Local port listening is restricted. Publishing/provider checks need the user's network-capable terminal unless permissions/tools change.
- Google Drive plugin discovery found an available but unconnected plugin; no Sheets document session was connected. There is no direct Apps Script or Cloudflare plugin available here.

## Legacy resources (not the production path)

- Sheet: https://docs.google.com/spreadsheets/d/1Rp3VySd9w5pnUQ1psB2x7KWHE_X8Gh40mfjtwaQ0B8I/edit
- Apps Script project: https://script.google.com/u/0/home/projects/1SAWJPY3Pz6pGZpUQF8eidq37oLh4xvov5yycJUlnap2JK2Zx5evUL7cC/edit
- Apps Script URL: https://script.google.com/macros/s/AKfycbzbPhPhLoKEch0qxgPhugMdSTCR6fCWBU2nLmH6Xv65yrT_n9nswjTKK8RrxBorYPwkow/exec
- Source/setup: `integrations/google-sheets/Code.gs`, `SETUP.md`; HTML generated by build. Live script never independently verified. HTTP API uses `{ok,data}` / `{ok:false,error}`.
- `server.py` is the legacy Sheets proxy when AAWAN_SHEETS_URL or ignored config.json configures it; otherwise SQLite in data/community.sqlite3. Explicit AAWAN_SHEETS_URL="" selects SQLite.
- Unused private Sites registration, never published: `.openai/hosting.json` project `appgprj_6af1972d309881918159b19b9fc250f9`. Keep local identity; do not create duplicates. `.openai/` is ignored.

## Remaining product boundaries

No member login, self-service edit/delete, automatic matching, date ranges/open-ended dates, or spam/rate protection. Admins can edit/hide records through D1. Itinerary details beyond date/mode are free text. Anyone with website access can read active phone numbers and submit posts. Retries after ambiguous timeouts are not idempotent; check before resubmitting. Old SQLite/Sheets/browser records are not migrated automatically.

## Target GitHub repository supplied

User created/provided **https://github.com/faizhusaini/aawanjaawan**. Use origin URL `https://github.com/faizhusaini/aawanjaawan.git`. Attempted `python3 scripts/publish.py <URL>` from agent, but `git remote add` failed with `.git/config: Operation not permitted`; no remote, commit, or push was created by that attempt. User can run the exact same command from the project root in their normal IntelliJ terminal. Do not ask for the repository URL again. Commit identity remains Faiz Husaini <faizhusaini19@gmail.com>. Website deployment stays separate from Git push.


## GitHub fetch-first reconciliation

Verified local commit `197cfe2` exists; origin is https://github.com/faizhusaini/aawanjaawan.git. User's IDE push was rejected because remote main has its own commit. Extra remote named `main` also exists but was not modified. Agent fetch still cannot write .git/FETCH_HEAD (and external DNS was blocked earlier). Working tree was clean before this follow-up.

Updated `scripts/publish.py` to fetch/merge the remote with --allow-unrelated-histories before pushing, with per-command author identity and no force push. Only README.md/LICENSE/LICENSE.txt initialization conflicts are auto-reconciled: keep reviewed app doc and save remote text in docs/github-initial/. Code conflicts or existing unresolved merges stop. Added five passing focused tests in test/test_publish.py. No actual remote fetch/merge/push was performed by the agent. User can run `python3 scripts/publish.py` in their normal terminal, then use IntelliJ Git → Push if terminal authentication does not reuse IDE login.


## 2026-11-25: IntelliJ Fetch verified

User confirmed IntelliJ Git → Fetch successful. Read-only inspection now shows origin/main at `a92982d Initial commit`, containing only README.md; local main remains `197cfe2`. This confirms IDE authentication/access, not a completed merge or push. Existing uncommitted changes include new city-route work (migration 0002_city_routes.sql and frontend/backend updates); preserve them. Added `scripts/publish.py --prepare-only` for the user terminal: commits current local work, merges cached origin/main without fetch/push authentication, and instructs IntelliJ Git → Push. Only initialization documentation conflicts are reconciled automatically with both copies preserved. Focused tests cover no-network prepare and missing cached branch. Agent has not modified Git history.


## 2026-11-27: canonical project README

User explicitly requested the project README replace GitHub's initial README, without keeping that initial README as the project documentation. Confirmed local main at `bea6b81` with the detailed root README already retained after the merge. Removed `docs/github-initial/README.md` (the archived two-line initial GitHub README) and polished root README with current supported city routes and a clear Git/Cloudflare release distinction. Root `README.md` is canonical. This changes documentation only; no website deployment is needed. Commit/push must be verified separately; session Git metadata restrictions may still block it.
