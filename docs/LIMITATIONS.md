# Verification limits and remaining live work

- GEMINI_API_KEY is now configured and accepted. Real structured text generation passed with `gemini-3.5-flash-lite`. The configured legacy `gemini-2.5-flash` returned 404 for generation on this project, so model defaults were updated.
- Gemini image generation with `gemini-3.1-flash-image` remains blocked by this Google project's zero free-tier quota. The local installation selects Cloudflare Workers AI FLUX.1 schnell. One complete real case (The Vanishing Emerald) passed all publication checks with 3 suspects, 10 clues and 11 readable images. This does not establish the target generation success rate, representative latency or visual-clue quality across other cases and difficulties.
- The three showcase definitions and real-pipeline generator/importer are implemented. Their actual generated cases/images require `npm run fixtures:generate` after image quota is available. The generator was not started while this prerequisite was blocked. No authored/mock fixture is passed off as a showcase.
- Production email is optional and has not been wired to a delivery service. Development password reset links print to the server console as required. Supply an EmailProvider for production delivery.
- S3-compatible storage is implemented behind its adapter; a real bucket has not been exercised. Local storage is covered by automated tests. Cloudinary is not implemented because S3 is the chosen cloud alternative.
- Accessibility and responsive checks are automated plus visual inspection. A dedicated human assistive-technology audit and representative-device performance measurements remain useful release checks.
- Content screening uses a keyword precheck, provider safety settings, fiction-only prompts and semantic validation. Identification of all possible real-person names is not exhaustive and has not been evaluated against a real-provider corpus.
- Scripted suspect interviews and share cards (M9/M10) are stretch features and are not included in the MVP.

The implementation, mocked tests and one completed live case cannot establish broader quality, latency, cost or reliability. Run representative complete cases and create the three validated showcase fixtures before calling the full specification's M4/M8 release gates complete. Google's quota guidance is at https://ai.google.dev/gemini-api/docs/rate-limits.
