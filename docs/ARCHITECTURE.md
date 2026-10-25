# Architecture

```text
React / Vite ── cookie + CSRF ──> Express REST API ──> MongoDB
                                      │                 ↑
                           protected asset route        │ leases / stages
                                      ↓                 │
                             Local disk or S3 <──── Generation worker ──> Gemini
```

The API never invokes a language model. It creates a durable job. The worker alone constructs the truth, suspects, evidence and images. Public DTOs allowlist fields and never import solution records. Accusation, hint and results services are the only gameplay readers of the private solution collection.

Eight domain collections: users, mysteries, suspects, evidence, mysterysolutions, investigationprogress, generationjobs, assets. Mongo-backed sessions are infrastructure. Completed progress is immutable. A solution freezes when a mystery is published. Every child record is scoped through its parent mystery and owner.

Mongo standalone is supported. Records and required assets are written before the final conditional status flip to `ready`; a crash cannot expose a partially written case. Worker leases expire after five minutes and refresh while processing. Stage outputs are checkpointed privately, allowing restart without duplicate publication.

Production uses HTTPS, an explicit client origin, secure cookies, durable MongoDB and private file storage. Place the API behind a reverse proxy and set its trusted proxy policy for your actual infrastructure. Never serve the storage directory as public static files.
