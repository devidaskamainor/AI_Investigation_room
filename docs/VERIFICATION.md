# Verification report

Verified locally on 2026-10-25. These are executed results, not planned checks.

## Full live case generation and repair follow-up

The saved **The Vanishing Emerald** case completed through the real worker at 100% and was published as ready. It contains 3 suspects, 10 evidence items and 11 generated images. All 11 images were read through the owned asset service and passed image-byte checks; the solution is frozen. The successful retry used one repair cycle, passed semantic review and the blind solver, and recorded zero solver failures. This verifies one complete real Gemini-text/Cloudflare-image case, not a general generation success rate or the three showcase fixtures.

Root causes were incomplete timeline indexing/time bounds, metadata repairs sent to the content writer, and the model repeatedly ignoring minimum evidence-category counts. Fixed facts now determine the timeline index and enclosing bounds without changing the approved answer or fact times. Evidence-plan requests use named required slots with single-value category enums, then decode to the original strict array contract. All metadata and content still come from the AI and must pass the existing fairness checks. The new wire schema also passed a separate real Gemini compatibility request using synthetic test data only.

Final checks: **172 tests passed across 24 files**, lint passed, and the production build/client secrecy scan passed. Coverage gates passed with 94.83% statements, 86.25% branches, 98.34% functions and 94.83% lines. Daily generation and manual retry limits remain enforced; the saved case completed on its third manual retry. No solution details or credentials were printed.

## Planning request failure follow-up

Inspected the failed job's safe metadata: it stopped at planning (5%) without a saved plan or token-usage checkpoint. Reproducing the planner request returned HTTP 400 INVALID_ARGUMENT; the same provider options with a minimal schema passed. The adapter now sends a smaller structural decoding schema and supplies the complete contract in instructions, while retaining strict server-side Zod validation. A real call through the updated production planner passed and returned the requested three suspects. No solution details or credentials were printed.

The independent image probe still returned 429 with free-tier limits of 0. The failed user case was not automatically retried into that known quota block. New image-quota failures have an explicit safe reason, and the retry action is displayed next to the failure message. All 59 targeted schema/provider/pipeline/asset/failure-recovery tests passed across 8 files. Lint, the production build and client secrecy scan passed. The direct and frontend-proxied API health endpoints both returned 200 with database ok.

## Registration connectivity follow-up

The frontend was reachable while the API port was offline. Startup diagnosis identified a newly configured Atlas SRV connection failing before the API could listen. The user selected local MongoDB, so only MONGODB_URI was restored to the working local address. Other settings, including the Gemini key, were preserved.

The API and worker were started successfully. Both the direct API and the frontend's proxied health endpoint returned 200 with database ok. A CSRF-protected registration request through the actual frontend proxy reached normal body validation; deliberately invalid form values were used so the diagnostic did not create an account. No new Gemini call was made during this follow-up.

## Session-origin fix and MongoDB follow-up

Reproduced a valid-token request from http://127.0.0.1:5173 failing with CSRF_ERROR while the configured localhost origin passed the security check. Development origin handling now accepts equivalent loopback addresses on the same protocol/port; production origin matching remains exact. The running API was verified after reload: both local origins reached normal body validation and an external origin was rejected with ORIGIN_NOT_ALLOWED. Invalid bodies were used so no user account or mystery was created by this check.

The 22 origin/CSRF, account and API regression tests passed, and lint passed. MongoDB's local Windows service was running and a direct ping using the configured MONGODB_URI succeeded. The URI and API key were left unchanged. README now includes local and Atlas connection setup.

## Live-provider follow-up after key configuration

The key is now configured and was accepted for model listing. The legacy `gemini-2.5-flash` generation request returned 404 for this project. A real text request and the structured JSON text portion of `npm run test:live` both passed with `gemini-3.5-flash-lite`.

The image portion failed with 429 for `gemini-3.1-flash-image`. A separate safe diagnostic confirmed free-tier requests-per-day, requests-per-minute and input-token limits of **0** for that model. The full live check therefore remains failed; no image or full case is reported as generated. Showcase generation has not been started while required image access is blocked. Model settings were updated while preserving the API key. Diagnostics print only safe stages/codes and quota metadata, never credentials.

After updating model defaults, the 14 configuration, setup and provider tests passed, and lint passed. The user-provided API key was verified unchanged by the configuration edit.

The original pre-key implementation verification follows; its missing-key result describes that earlier run.

- `npm run lint`: passed, including JSX undefined-component checks.
- `npm run test:coverage`: **110 tests passed across 16 files**. The configured 80% statement/branch/function/line gates all passed.
- Tracked backend/shared coverage: **94.65% statements, 83.94% branches, 97.27% functions, 94.64% lines**. Services, middleware and shared schemas/constants are included. These figures do not claim complete frontend or route/controller coverage.
- `npm run test:e2e`: **7 browser tests passed** in installed Edge. Landing/creation, investigation/viewer and results tested at 360, 768 and 1440 pixels; the complete persisted detective journey also passed.
- `npm run build`: passed. The actual built client secrecy scan passed for all three generated JS/CSS/HTML files.
- Real API and worker process startup, MongoDB health and missing configuration handling passed in isolated tests.
- Original `spec.md` and preserved `specs/SPEC.md` SHA-256 hashes matched.
- `npm run stats`: executed against the local application database. It contained zero jobs; success rate, duration and retries correctly reported null instead of invented measurements.
- `npm run test:live`: attempted and stopped with **Configuration error: GEMINI_API_KEY**. No real text/image call was made. Real-pipeline fixtures were not generated.

## Executed security and integrity checks

- Active-case metadata, suspect, evidence, progress and job responses pass the private-field leak scanner.
- Public DTOs allowlist nested fields and discard poisoned unknown/private fields.
- The production browser bundle contains no forbidden solution/configuration names.
- Unauthenticated assets are denied; foreign owners receive 404 across protected case, evidence, progress, notes, hints, job and asset endpoints.
- Invalid ObjectIds, unsupported creation fields, foreign accusation references and oversized JSON are rejected safely.
- Bcrypt cost 12, normalized email, refreshed cookie sessions, CSRF enforcement, generic recovery replies and single-use hashed reset tokens pass.
- A fourth hint is rejected; viewed evidence, notes and ordered/labelled pins persist.
- Correct first/second scoring, wrong-first limited nudge, second-wrong zero score, completed immutability and simultaneous final submissions pass.
- Invalid schemas/JSON, unknown references, impossible timelines, missing exclusion paths, orphan evidence and missing image prompts fail validation.
- Blind-solver failure exhausts two repair cycles without publishing. A failing evidence record is repaired independently.
- Expired leases and graceful stage release resume without duplicate publication. Stale pre-job reservations recover.
- Standalone publication uses the final conditional ready flip; replica-set transaction success and rollback on lease loss pass.
- Required image failure blocks publication. Storage paths reject traversal, image content is checked, owned deletion cascades and an in-flight image write leaves no orphan file after deletion.
- Generated markup renders as inert text. CCTV reconstruction/fiction labels and frame controls are verified.
- Demo import checks strict provenance metadata, schemas, fact graph and actual image bytes. Test provenance is simulated exclusively inside the test suite; it is not a claim that real showcase cases exist.

## Cloudflare image integration follow-up (2026-10-25)

- Full `npm run test:coverage`: **159 tests passed across 22 files**. Configured coverage gates passed: 95.16% statements, 85.84% branches, 98.29% functions and 95.15% lines.
- Cloudflare tests cover account-scoped authenticated requests, image bytes, safe status mapping, bounded retries, timeouts, malformed responses, prompt length and provider selection. An isolated pipeline test generated all eight required assets through the Cloudflare adapter's mocked HTTP transport and verified publication and owned asset reads.
- `npm run lint` and `npm run build` passed. The built-client scan includes `CLOUDFLARE_API_TOKEN`; no server credential setting appeared in browser assets.
- The local API health endpoint returned 200 with process/database ok. Existing `.env` settings were preserved while blank Cloudflare Account ID/token fields were appended for user entry.
- After the user entered their Account ID/token and selected Cloudflare, `npm run test:live` passed both real calls: Gemini `gemini-3.5-flash-lite` structured text and Cloudflare `@cf/black-forest-labs/flux-1-schnell` image generation. The returned image passed byte/type checks. Credentials were not printed. Duplicate development processes were replaced by one API and one worker using the saved environment; the frontend was restarted. Successful complete live generation and showcase verification are still release prerequisites.

## Environment and limits

Local environment: Windows, Node 25.8.1, installed MongoDB 8.2.6, Edge, React 18.3.1 and Vite 6.4.5. Tests use temporary MongoDB databases, including a one-node replica set. They do not modify the user's application cases or spend provider quota. Sandbox permissions were required for npm downloads and Vite/MongoDB/browser tooling.

The supplied CI workflow is configured for Node 24 and Linux Chromium but has not run remotely. S3 behavior is tested through a mocked SDK transport, not a live bucket. Desktop/mobile screenshots were inspected and are stored in `docs/assets/`. React Router future-version warnings and the memory-server installed-binary version notice are non-failing informational output.

Real Gemini generation quality, model/account access, generation success/latency targets, the three real-pipeline showcase exports and representative-device performance measurements remain unverified. See [known limitations](LIMITATIONS.md) and [milestones](../MILESTONES.md).
