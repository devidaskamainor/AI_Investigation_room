# Showcase cases

`manifest.json` defines the three required showcases. The actual case JSON files and their generated images are produced by `npm run fixtures:generate`, using your real Gemini credentials and the same pipeline and validator as ordinary cases. They are private server-side files and are never copied into the client bundle.

No generated showcase artefacts are included yet: the Gemini key and live text output are verified, but image generation is blocked by zero free-tier image quota on the Google project. Authored test fixtures live separately under `server/test/fixtures/` and are never represented as real-pipeline showcase cases.

Set `DEMO_MODE=true` after generating the files. The dashboard lists only fixtures that exist and pass validation/provenance checks. Production rejects demo mode. Imported demo cases are labelled **Pre-generated demo case**. Each import counts toward the development account's daily case limit.
