# AI Mystery Room

A solution-first detective game. React client, Express API, MongoDB-backed worker and Google Gemini.

![Mystery Room desktop preview](docs/assets/landing-desktop.png)

The MVP implementation includes accounts, background generation, validation and repair, six evidence viewers, notes, pins, hints, two-attempt theory scoring, results, history and deletion. A complete live case, The Vanishing Emerald, reached 100% with 3 suspects, 10 clues and 11 verified images after the timeline/evidence repair fixes. Images can use Gemini or Cloudflare Workers AI; this local installation selects Cloudflare because the Google project's Gemini image quota is zero. Broader reliability measurements and showcase exports remain pending. See [verification](docs/VERIFICATION.md) and [known limits](docs/LIMITATIONS.md).

## Quick start

Use Node 24 LTS (22.12+ supported) and MongoDB 7+. On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`.

1. `npm install`
2. `npm run setup` creates `.env` with two independent random secrets and preserves an existing file.
3. Set `GEMINI_API_KEY` in `.env` for text generation. Configure an image provider below and adjust `MONGODB_URI` if needed.
4. Start MongoDB.
5. `npm run dev`
6. Open http://localhost:5173.

The API listens at http://127.0.0.1:5000/api/v1. The client proxies `/api` to it. `npm run dev` starts the API, worker and client together. `CLIENT_URL` defaults to **http://localhost:5173**. Development also accepts its `127.0.0.1` and `::1` equivalents on the same protocol and port; production requires the exact configured origin. Stay on one address while signing in and investigating, since browsers keep cookies separately for each host. A missing Gemini key stops API/worker startup explicitly; no canned case replaces real generation.

The API and worker can also run separately with `npm run dev:api` and `npm run dev:worker`; the frontend uses `npm run dev:client`. Build with `npm run build`; preview the client with `npm run preview --workspace client` and configure its actual origin in `CLIENT_URL`. Production requires HTTPS, secure cookies and a private storage backend. The API binds to loopback and trusts only loopback reverse proxies.

```text
React / Vite ── cookie + CSRF ──> Express API ──> MongoDB
                                     │              ↑
                             protected assets       │ durable jobs + leases
                                     ↓              │
                              Local disk / S3 <── Worker ──> Gemini
```

## Commands

`npm run lint`, `npm test`, `npm run build`, `npm run test:coverage`, `npm run test:e2e`, `npm run test:live`, `npm run stats`, `npm run fixtures:generate`.

Default tests use mocked providers and isolated temporary MongoDB databases; they do not spend Gemini quota or modify your application data. Windows tests use the installed MongoDB binary when found. Elsewhere mongodb-memory-server downloads one. Browser tests use installed Edge on Windows and Playwright Chromium elsewhere (`npx playwright install chromium`). Override with `PLAYWRIGHT_CHANNEL` if required.

`npm run test:live` intentionally makes one real text and one image call. `npm run fixtures:generate` creates the three showcase cases through the real pipeline, validates them and exports their images. Then set `DEMO_MODE=true` and restart. Demo mode is forbidden in production. The dashboard never advertises missing or invalid fixtures.

`npm run stats` reads actual local generation results and reports null rates when no runs exist. It does not require Gemini credentials. Coverage reports are written to `coverage/`; browser reports to `playwright-report/`. CI runs lint, coverage, build and browser checks.

## Configuration

- Required: `MONGODB_URI`, independent `SESSION_SECRET` and `PASSWORD_RESET_TOKEN_SECRET` (32+ characters), `GEMINI_API_KEY`.
- `.env` is the only environment file. `npm run setup` creates it from safe defaults built into `scripts/setup.mjs` and preserves existing settings.
- Models: `GEMINI_MODEL`, `GEMINI_IMAGE_MODEL`, `CLOUDFLARE_IMAGE_MODEL`; timeouts, retry limits and image concurrency are configurable in `.env`.
- Default model names: `gemini-3.5-flash-lite` for text and `gemini-3.1-flash-image` for Gemini images. This local installation uses `IMAGE_PROVIDER=cloudflare` with `@cf/black-forest-labs/flux-1-schnell`; a real text-plus-image check passed. To use Gemini images instead, enable suitable Google image access/billing and positive quota. The unavailable legacy 2.5 defaults have been replaced; no API key needs to be reposted.
- Storage: `ASSET_STORAGE_PROVIDER=local` writes to `ASSET_STORAGE_DIR`. For `s3`, set bucket, access key, secret, region and optional endpoint; buckets remain private and images pass through the API.
- Authentication: `CLIENT_URL` must match your browser origin in production. Development accepts equivalent loopback addresses on the configured port. `COOKIE_DOMAIN` is optional. The API uses 7-day sliding cookie sessions, CSRF headers and ownership checks.
- Development recovery prints the reset link to the API console. A production email adapter is optional and must be supplied for email delivery.

Never commit `.env`, expose the storage directory publicly, or copy server-side case fixtures into the frontend. All cases and evidence are fictional; CCTV consists of reconstructed frames, not real video.

## Cloudflare image setup

Gemini continues generating stories and text clues. To generate images with Cloudflare Workers AI, edit these settings in the root `.env` (replace the two placeholder values):

```dotenv
IMAGE_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=your-32-character-account-id
CLOUDFLARE_API_TOKEN=your-workers-ai-api-token
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-1-schnell
```

The existing `IMAGE_PROVIDER` line should be changed rather than duplicated. The Account ID is the 32-character identifier shown under **Workers AI > Use REST API > Get Account ID**. It is not your email address or the token ID. The API token needs Workers AI Read and Edit permissions for that account. See [Cloudflare's setup guide](https://developers.cloudflare.com/workers-ai/get-started/rest-api/).

Save `.env` and restart the API and worker: `.env` edits are not reloaded automatically. For a combined development terminal, press Ctrl+C and run `npm.cmd run dev`. For separate terminals, restart `npm.cmd run dev:api` and `npm.cmd run dev:worker`; the frontend can remain running. Keep `GEMINI_API_KEY` configured. Run `npm.cmd run test:live` to make one real text and one image request with the selected providers. A case whose three attempts are exhausted must be replaced with a new investigation.

Cloudflare's Free plan currently includes 10,000 Neurons of daily compute, shared across Workers AI calls; this is not a fixed image count. See [pricing and quotas](https://developers.cloudflare.com/workers-ai/platform/pricing/). Images still go through the same byte checks and private storage. The supported FLUX model has a 2,048-character prompt limit; generation instructions request concise visual prompts, and oversized prompts fail explicitly rather than losing clue details. Tokens stay on the server.

## MongoDB connection setup

`MONGODB_URI` is required in `.env`: the API, worker, accounts and cookie sessions all use MongoDB. For the installed local MongoDB service, use:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/ai-mystery-room
```

Keep the MongoDB Windows service running. The application creates its collections and indexes on startup; Atlas is optional for local development. Restart the API and worker after changing `.env`.

To use Atlas instead, create a cluster and a database user, add your current IP under Network Access, then choose **Connect → Drivers → Node.js** and copy the supplied URI into `MONGODB_URI`. Replace the database-user password placeholder and set the database name to `ai-mystery-room`. Percent-encode reserved characters in credentials. See the [official Atlas connection guide](https://www.mongodb.com/docs/atlas/driver-connection/). Keep credentials in `.env`.

## Repository guide

- `client/src/`: routes/pages, shared components, central API client and auth state.
- `server/src/`: thin controllers, route wiring, services, models, validation, prompts and queue worker.
- `shared/`: client/server request schemas and game constants.
- `fixtures/demo-cases/`: showcase manifest and real-pipeline export destination.
- `e2e/`: isolated test server and complete browser journeys.
- [API contract](docs/API.md), [data model](docs/DATA-MODEL.md), [architecture](docs/ARCHITECTURE.md), [AI validation](docs/AI.md), [demo script](docs/DEMO.md).

See `MILESTONES.md`, `DECISIONS.md`, and the original `specs/SPEC.md` for the contract and verification status.
