# Implementation checklist

The original contract is preserved in `specs/SPEC.md`. Milestones close after checks actually run.

- [x] M1 Foundation — workspace, client, API, worker, database, validated configuration, health, tooling. Initial checks: lint, production build, 4 tests passed.
- [x] M2 Accounts and models — eight domain models, sessions, CSRF, recovery, ownership, DTOs, leak tests. Full suite now passes without teardown errors (16 tests including core frontend).
- [x] M3 Core frontend — landing, auth, dashboard, create, progress, responsive shell. Four form tests, three browser tests at 360/768/1440 px, lint and build passed.
- [ ] M4 release gate — implementation and mocked tests complete: providers, prompts, durable stages, validation, targeted repairs, blind solver, restart recovery. A complete live Gemini-text/Cloudflare-image case reached 100% after the repair fixes. Broader quality/reliability and latency targets still need representative verification.
- [x] M5 Assets — Gemini and Cloudflare image adapters, local/S3 storage, private asset delivery, required-asset validation and cleanup. Local operations and mocked S3 operations tested; a real Cloudflare image request passed.
- [x] M6 Investigation — six viewers, notes/autosave, ordered labelled pins, hints and view tracking. Persistence, ownership and responsive browser checks pass.
- [x] M7 Accusation and results — theory drawer, scoring, immutable/concurrent completion, reveal, history and deletion. Wrong-first/right-second and second-wrong paths tested.
- [ ] M8 release gate — implementation, CI, responsive/accessibility checks, metrics, docs and demo importer/exporter complete. The key is configured, but the three real-pipeline showcase cases and reliability/latency measurements require working image quota.
- [ ] M9/M10 Stretch — scripted interviews and share cards (outside required MVP).

Live generation and real-pipeline showcase fixtures are tracked separately from mocked checks. The real text+image check and one full case passed after switching images to Cloudflare and fixing timeline/evidence repairs. The three showcase fixtures and broader generation targets remain pending.

## Files and verification by milestone

- M1: root package/config files, `client/` entrypoint, `server/src/config/`, `app.js`, `server.js`, `worker.js`, `scripts/setup.mjs`. Actual API and worker startup, health, missing config, lint and build checked.
- M2: `server/src/models/`, `middleware/`, `services/auth/`, `services/mystery/dto.js`, auth routes/controllers and account/security tests. Password hashing, reset, CSRF, ownership and public response scans checked.
- M3: `client/src/pages/`, `components/`, `api/`, `lib/`, responsive styles and core form/browser tests. 360/768/1440 layouts checked.
- M4: `server/src/prompts/`, `validators/generation.js`, `services/ai/`, `services/generation/`, `services/mystery/mysteryValidator.js`, `jobs/`. Checkpoints, graceful/hard restart, bounded repair, quotas, blind-solver failure and transaction rollback checked with mocks.
- M5: `services/assets/`, asset routes/controllers and adapter tests. Image bytes, path confinement, required assets, private delivery and owned deletion checked.
- M6: evidence services/controllers/routes, `EvidenceViewer.jsx`, `DetectiveBoard.jsx`, `Room.jsx`. All six viewer types and persisted gameplay checked.
- M7: scoring services/controllers/routes, `Theory.jsx`, `Results.jsx`. Pure scoring, immutable completion under racing requests, results and replay checked.
- M8: `fixtures/demo-cases/manifest.json`, demo services, `scripts/`, `.github/workflows/ci.yml`, `docs/`, `README.md`, screenshots and full browser journeys. Real generated fixtures remain outstanding.

Exact final check results and environment limitations are recorded in `docs/VERIFICATION.md` and `docs/LIMITATIONS.md`.
