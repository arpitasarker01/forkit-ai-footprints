# Forkit Census Agent Instructions

Before changing code:

1. Run `git status --short --branch`.
2. Read `docs/PRODUCT_BOUNDARY.md`, `PRIVACY.md`, and `STATUS.md`.
3. State the affected surface: runtime discovery, model discovery, agent
   discovery, reporting, privacy, packaging, CI, or docs.
4. Treat the product status as `future/investigate` and the active validation
   scope as macOS only.

## Non-negotiable rules

- Census is read-only and metadata-only.
- Never add Forkit.dev authentication, passport Mint, registry writes,
  Runtime_C2 mutation, telemetry upload, billing, or deployment behavior.
- Reject non-loopback runtime endpoints.
- Never retain or report raw process commands, process IDs, full paths, model
  bytes, prompts, responses, credentials, or account identity.
- Detection creates reviewable inventory suggestions only.
- Do not claim measured accuracy without a labeled benchmark.
- Do not publish npm or market Census as production without founder approval and
  an intentional Forkit.dev production-lock promotion.

## Required validation

```bash
npm ci
npm test
npm run smoke:package
```

Detector changes require positive, negative, deduplication, and privacy tests.
