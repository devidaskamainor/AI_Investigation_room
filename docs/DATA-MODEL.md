# Data model and ownership

Eight Mongoose domain models are defined in `server/src/models/index.js`:

- **User**: lowercase unique email, name and select-hidden bcrypt password hash. Recovery stores a select-hidden HMAC token hash and expiry. An active job reservation and UTC quota counter prevent concurrent creation races.
- **Mystery**: owner, creation options, public premise, incident, motive options and child references. Only ready cases are playable. Original scenarios and private solution references are omitted by DTOs.
- **Suspect**: public identity, relationship, possible motive, alibi, statement and private-route portrait asset reference.
- **Evidence**: category, source, timestamp, suspect/asset references and per-category Zod-validated content. No truth flags or hidden roles.
- **MysterySolution**: all canonical truth, fact graph, internal evidence mapping, hints, nudge, explanation and private generation metadata. Checkpoints persist only here, never in jobs or client data. frozenAt prevents rewriting an approved solution.
- **InvestigationProgress**: unique user + mystery, views, ordered pins, timestamped notes, hint count, accusations and immutable completed result. Optimistic version checks serialize concurrent gameplay changes.
- **GenerationJob**: public-safe stage/progress, idempotency key, lease, bounded retry/repair counts and reliability counters. Unique owner + idempotency key; partial unique owner index across active states.
- **Asset**: case ownership, validated image type, private storage key and generation status. Never exposed as a database object; only authorized image bytes are returned.

Required owner/date, parent/category, unique email, unique solution, unique progress and queue lease indexes are created at startup. Sessions use connect-mongo's additional infrastructure collection. Models use strict field handling.

Every child operation first verifies the owning mystery. Deletion archives/cancels the case, removes assets and children, removes the parent and releases only that case's active reservation. Workers recheck ownership/existence and leases around writes. Public DTOs reconstruct nested content from explicit field allowlists.
