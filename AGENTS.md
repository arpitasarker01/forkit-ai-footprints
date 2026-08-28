# Forkit AI Footprints Agent Instructions

Before changing code:

1. Run `git status --short --branch`.
2. Read `docs/PRODUCT_BOUNDARY.md`, `PRIVACY.md`, and `STATUS.md`.
3. State the affected surface: runtime discovery, model discovery, agent
   discovery, reporting, privacy, packaging, CI, or docs.
4. Treat the product status as `current` for the approved npm-first Apple
   Silicon macOS release. Other operating systems remain `future/investigate`.

## Non-negotiable rules

- AI Footprints is read-only and metadata-only.
- Never add Forkit.dev authentication, passport Mint, registry writes,
  Runtime_C2 mutation, billing, or deployment behavior. The only permitted
  network write is the production-lock-approved, versioned, consented,
  aggregate-only Global AI Preview contribution.
- Reject non-loopback runtime endpoints.
- Never retain or report raw process commands, process IDs, full paths, model
  bytes, prompts, responses, credentials, or account identity.
- Detection creates reviewable inventory suggestions only.
- Do not claim measured accuracy without a labeled benchmark.
- Publish only an exact founder-approved version after the Forkit.dev
  production lock is intentionally promoted and every release gate passes.

## Required validation

```bash
npm ci
npm test
npm run smoke:package
```

Detector changes require positive, negative, deduplication, and privacy tests.
