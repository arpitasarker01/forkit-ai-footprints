# Product Boundary

Sector: CLI discovery and local inventory

Status: `future/investigate`

Forkit AI Footprints is the public name for the experimental metadata-only
inventory CLI. Its prepared package and command are `forkit-ai-footprints`,
with `forkit-census` retained temporarily as a developer compatibility alias.

## Allowed MVP

- discover supported local runtime APIs;
- inventory model metadata;
- classify and deduplicate known local agent products;
- produce human and JSON reports;
- generate an explicitly saved, self-contained aggregate-only local HTML share
  page with no automatic network requests;
- run a token-protected UI bound only to `127.0.0.1`, keep the current report in
  memory, and show local runtime, model, AI-app, and AI-tool names without
  exposing them in saved/shareable or anonymous/global artifacts;
- keep an owner-only local device journal containing the Mac display name, first
  scan time, last scan time, and scan count; never add the device name to a saved
  share page or anonymous/global payload;
- continuously monitor supported process trees at a one-second target interval,
  use repeated cumulative CPU-time deltas and hysteresis to distinguish Working
  now from Open / idle, and exclude the Forkit process tree and sleep gaps;
- keep that monitor owned by the local service so it survives window/browser
  closure until the user explicitly stops or quits;
- compare a browser-local numeric guess with the discovered model-record count;
- show clearly labelled supported-process CPU/memory context and separately
  measured Forkit CPU/RAM/history overhead without task attribution;
- expose a resource-evidence manifest that marks unsupported exclusive task
  attribution, GPU, and network traffic as unavailable instead of estimating;
- diagnose local AI Footprints readiness;
- prepare a consent-gated, aggregate-only anonymous contribution preview without
  transmitting it;
- package and test an experimental macOS-only release candidate.
- display optional cooperating-app chat/workspace metadata locally only, without
  extracting window titles, folder names, prompts, or command text;

Ubuntu, Windows, Android, and other operating systems are outside the current
support claim until separately validated and promoted.

## Explicitly excluded

- Forkit.dev authentication;
- passport draft creation or final Mint;
- registry writes;
- Runtime_C2 mutation or heartbeat;
- billing, plans, workspaces, or account state;
- telemetry or Global AI Footprints upload;
- remote endpoint inspection;
- mobile packaging;
- npm publication or production deployment.

## Promotion gate

AI Footprints remains `future/investigate` until founders intentionally update
`docs/PRODUCTION_LOCK.md` in `arpitasarker01/forkit_dev_base`.

The standalone repository cannot promote itself. A future promotion must define
its relationship to Forkit Connect, website copy, privacy/legal review, package
ownership, support expectations, and release gates.
