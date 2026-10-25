# How the AI is kept honest

The Gemini adapter separates its structural decoding schema from the complete validation contract. Complex nested length/range/pattern constraints caused an observed HTTP 400 from the provider; the API now receives the structure, required keys, enums and nullability, while the complete contract is included in system instructions and enforced by the unchanged strict Zod schema. This affects provider compatibility only: invalid values still fail before persistence. The real planner passed after this change. Image quota failures now produce an explicit safe message and never publish a partial case.

The planner fixes a canonical solution first. All other stages derive their output from those approved facts. A fact graph ties evidence to motive, opportunity, means, contradictions and innocent-suspect exclusions.

Planner preprocessing derives the context window from approved fact/event times and indexes approved facts missing from the canonical timeline. Existing truth, event timestamps, culprit and motive are preserved. Deterministic validation still checks every reference and chronology rule. Written evidence is checked before image calls, and plan metadata failures are routed to the evidence planner rather than repeatedly rewriting content that cannot fix them. Internal findings are checkpointed for diagnosis; they are never part of player DTOs.

Each version-controlled prompt has a strict Zod output contract. Structured Gemini JSON is parsed, not executed. Unknown keys and invented references fail validation. User scenarios are delimited data, not instructions. Every artefact is fictional, age appropriate and labelled.

The evidence planner uses named required output slots whose IDs and categories are constrained by literal enums. Valid existing layouts are preserved; missing required types replace only excess category slots. The AI generates every item's metadata and fact links. The adapter converts the named output back to the original array contract and validates it before persistence. Required evidence counts are therefore represented in the decoding structure rather than relying only on prose instructions or array minimums.

Before publication: schema and reference checks, timeline and asset checks, fact-graph proof, semantic review, then an independent blind solver receiving only public data. Repairs target failing records and are bounded to two cycles. Failed jobs stay visibly failed. Required clue-bearing assets cannot use placeholders.

The browser receives no canonical facts, evidence roles, solution, answer flag or future hints. Hints are released individually by the server. The reveal uses existing evidence only and becomes available after completion.

Images can use Gemini or Cloudflare Workers AI FLUX.1 schnell. The worker, live check and fixture exporter share the same IMAGE_PROVIDER selection. Cloudflare credentials remain server-side; decoded image bytes pass the same size/type checks and private storage path. Visual generation instructions request compact style/image prompts for FLUX's 2,048-character limit. Oversized prompts fail rather than silently dropping clue details.

Default tests mock providers and never spend API quota. `npm run test:live` explicitly invokes real Gemini text generation and the selected image provider. `npm run fixtures:generate` produces showcase cases through the real worker pipeline; it is intentionally separate from unit-test fixtures.
