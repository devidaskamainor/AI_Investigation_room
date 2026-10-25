# REST API

Development accepts equivalent localhost, 127.0.0.1 and ::1 origins only on the configured protocol and port. Production accepts only the configured origin. Both CORS and CSRF use this policy. A denied origin returns 403 `ORIGIN_NOT_ALLOWED`; an absent or invalid session token returns 403 `CSRF_ERROR`. Local address aliases still require valid session cookies and CSRF tokens.

Base: `/api/v1`. Success: `{ success: true, data }`. Error: `{ success: false, error: { code, message, details? } }`. Every state-changing request requires the `X-CSRF-Token` returned by `GET /auth/csrf`. Send the HttpOnly cookie using `credentials: include`. Login and registration rotate the session and return a new CSRF token; the central client updates it.

Public: `GET /health`, `GET /auth/csrf`, `POST /auth/register`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`. `POST /auth/logout` and `GET /auth/me` require authentication.

Protected routes (foreign resources return 404):

- `POST /mysteries`: scenario, optional title, difficulty, mysteryType, suspectCount; required `Idempotency-Key` (8–128 word/hyphen characters). Returns 202 with mysteryId and jobId. Five daily creations, one active job.
- `GET /mysteries?page=1&limit=12&status=`: paginated own cases; All, in_progress and completed views.
- `GET /mysteries/:id`: public metadata. `DELETE` removes the whole owned case and files.
- `GET /generation-jobs/:jobId`; `POST /generation-jobs/:jobId/retry`: safe progress/error, at most three manual retries.
- `GET /mysteries/:id/suspects[/:suspectId]`.
- `GET /mysteries/:id/evidence[/:evidenceId]`: list supports category and suspectId filters; detail includes typed content.
- `POST /mysteries/:id/evidence/:evidenceId/view`: persist view tracking.
- `GET /mysteries/:id/progress`: views, notes, pins, hint count, attempts remaining and completed score.
- `POST /mysteries/:id/progress/notes`: `{text}`; `PATCH` and `DELETE /progress/notes/:noteId`.
- `PUT /mysteries/:id/progress/pins`: `{pins:[{evidenceId,label}]}`, maximum twelve, order preserved.
- `POST /mysteries/:id/hints`: exactly the next hint. A fourth returns 409 HINT_LIMIT_REACHED.
- `POST /mysteries/:id/accusation`: `{suspectId,motiveOptionId,evidenceIds}`. Wrong first response includes only correct, resolved, attemptsRemaining and nudge. Completion returns score/rank. Later accusations return 409 INVESTIGATION_COMPLETED.
- `GET /mysteries/:id/results`: completed cases only; earlier requests return 409 INVESTIGATION_NOT_COMPLETED. The reveal allowlists trusted solution fields.
- `GET /assets/:assetId`: authenticated image bytes, private cache headers; never a public storage URL.
- With DEMO_MODE only: `GET /demo-cases` lists available, validated real-pipeline fixtures; `POST /demo-cases/:slug` imports one as an owned labelled case.

All evidence/progress/gameplay reads require a ready case. ObjectIds, query values and bodies are validated. Important errors: VALIDATION_ERROR (400), INVALID_ACCUSATION (400), UNAUTHORIZED (401), CSRF_ERROR (403), RESOURCE_NOT_FOUND (404), MYSTERY_NOT_READY (409), GENERATION_IN_PROGRESS (409), INVESTIGATION_COMPLETED (409), RATE_LIMIT_EXCEEDED (429), INTERNAL_SERVER_ERROR (500). No provider stack traces are returned.
