# Forkit Census Status

Last updated: 2026-08-22

Version: `0.1.0`

Status: `future/investigate`

## Implemented

- independent package and `forkit-census` executable;
- unified runtime, model-file, and agent scan;
- Ollama, LM Studio, and loopback OpenAI-compatible providers;
- Ollama content-addressed identity when the runtime exposes a digest;
- metadata-only filesystem model identity;
- exact-token agent signatures;
- product-level agent deduplication with process instance counts;
- human and JSON reports;
- loopback-only endpoint enforcement;
- doctor command;
- local unit and isolated package-smoke tooling;
- hosted cross-platform CI definition.

## Intentionally absent

- login and account state;
- passport draft or Mint actions;
- Forkit.dev registry writes;
- Runtime_C2 mutation;
- remote telemetry;
- model byte reads;
- raw command/path output;
- npm publication;
- production promotion.

## Validation state

Local validation on macOS/arm64 with Node 24:

- `npm ci`: pass; zero reported vulnerabilities;
- `npm test`: 20/20 pass;
- `npm run smoke:package`: pass;
- `forkit-census doctor --json`: pass;
- real-device unified census: pass;
- privacy scan of the real report: no home-directory, Windows-user-path,
  API-key-prefix, API-key-flag, or session-token leak found.

The real-device census aggregated 18 Codex-related processes into one Codex
product and did not reproduce Forkit Connect's prior `Agno Tooling` false
positive. This is encouraging evidence, not an accuracy benchmark.

Hosted macOS, Ubuntu, and Windows validation is pending the first GitHub Actions
run. Census must not be called cross-platform ready until every required job is
green.

## Remaining before an experimental release candidate

- pass the hosted macOS, Ubuntu, and Windows matrix;
- complete founder review of the product boundary;
- keep npm publication and production promotion as separate approvals.

The npm name `forkit-census` returned `E404` on 2026-08-22 and therefore appears
unpublished. Availability is not ownership and must be rechecked immediately
before any separately authorized publication.
