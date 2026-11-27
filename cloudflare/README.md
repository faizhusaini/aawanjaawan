# Cloudflare deployment guide

- **Production** https://aawanjaawan.fun
- **Staging** https://aawanjaawan-dev.aawanjaawan.workers.dev
- **Production Worker address** https://aawanjaawan.aawanjaawan.workers.dev

The Worker, D1 database, and both custom domains have been deployed successfully. Hostinger remains the domain registrar; Cloudflare provides DNS, HTTPS, hosting, and database storage.

## Staging and production releases

From the repository root, install dependencies once:

```sh
npm ci
npm ci --prefix cloudflare
```

From the repository root, on `dev`:

```sh
npm run deploy:staging
```

This publishes the Worker and applies migrations using `wrangler.dev.jsonc` and the separate `aawanjaawan-dev` D1 database. Use fictional data for staging smoke tests. Check `/api/health`, both posting flows, and persistence across browser sessions.

After staging passes, merge `dev` into `main`. From the updated `main` checkout, authenticate if needed and deploy:

```sh
cd cloudflare
npm run login
npm run whoami
npm run deploy
```

If automatic browser login fails, use `npm run login -- --device --browser=false` and follow the verification URL/code. Keep credentials in Wrangler or the deployment environment; never commit them.

`npm run deploy` rebuilds the frontend, performs a bundle dry run, applies remote migrations, and publishes. It uses the existing production D1 UUID in `wrangler.jsonc`. Verify `aawanjaawan.fun` after deploying. Both deploy scripts check the active Git branch before starting.

## New account or fresh installation

The checked-in configuration identifies the current production database and domain. For another account, first remove the `routes` field and replace `database_id` with `REPLACE_WITH_DATABASE_ID`; choose a different Worker/database name if appropriate. The launch helper currently targets the database name `aawanjaawan`.

```sh
npm run login
npm run launch
```

The helper runs checks, lists the account's databases, reuses the matching database or creates one if absent, saves the verified UUID, applies migrations, and deploys. It stops on failure or an account/database mismatch. If multiple accounts are available, configure the intended account before proceeding.

To select an existing database manually:

```sh
npx wrangler d1 info aawanjaawan --json
python3 configure.py --database-id YOUR_REAL_DATABASE_ID
```

## Local development

```sh
npm run dev
```

Wrangler uses the staging configuration with a local D1 database. Local posts stay on the development machine. For remote tests, use the staging URL above.

## Domain setup and recovery

This is already configured for `aawanjaawan.fun`; it is not needed for routine updates.

1. Add the domain to Cloudflare on the Free DNS plan and retain any DNS records used by email or other services.
2. Enter the exact pair of nameservers assigned by Cloudflare in Hostinger's DNS / Nameservers settings. Registration stays at Hostinger.
3. Wait for the zone to become Active.
4. From this directory, run `python3 configure.py --enable-domain`, then `npm run deploy`.
5. Confirm both custom-domain triggers appear in the deployment output.

Worker custom domains require the apex and `www` hostname to be free of conflicting externally managed A/AAAA/CNAME records. Inspect those records before changing them; do not remove unrelated email or verification records. Cloudflare creates the Worker domain records and certificates. The Worker redirects `www.aawanjaawan.fun` to the apex.

A compatibility date cannot be in Cloudflare's future. Keep the established `2026-11-01` date unless intentionally testing an upgrade.

## Verify and maintain

- `/api/health` must return `{"ok":true,"storage":"d1"}`.
- Test both posting flows, then open another browser to confirm persistence.
- Test WhatsApp, mobile layout, date/direction filters, and the `www` redirect.
- Manage posts in Cloudflare's D1 Console. Set status to `completed` or `cancelled` to hide a post; keep the row for history.
- Export/back up data using Cloudflare's tools. Existing Sheets/SQLite/browser records are not automatically migrated.

The public API exposes active contact details and has no member authentication, owner edit/delete UI, rate limiting, or idempotent retries. See the root README for current behaviour and limits.

## References

- [D1 setup](https://developers.cloudflare.com/d1/get-started/)
- [Worker static assets](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Worker custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Hostinger nameservers](https://www.hostinger.com/support/1696789-how-to-change-nameservers-at-hostinger/)
