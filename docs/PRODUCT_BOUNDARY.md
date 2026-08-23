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
  memory, and return only aggregate display fields when the user selects Scan again;
- keep an owner-only local device journal containing the Mac display name, first
  scan time, last scan time, and scan count; never add the device name to a saved
  share page or anonymous/global payload;
- stream bounded near-real-time aggregate runtime/agent state to the local page
  over the token-protected loopback service;
- compare a browser-local numeric guess with the discovered model-record count;
- measure a user-started and user-stopped task window using only aggregate
  samples from strongly detected agent processes; disclose that shared-process
  background work may be included;
- expose a resource-evidence manifest that marks unsupported task attribution as
  unavailable instead of estimating GPU or network traffic;
- diagnose local AI Footprints readiness;
- prepare a consent-gated, aggregate-only anonymous contribution preview without
  transmitting it;
- package and test an experimental macOS-only release candidate.

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
