# Product Boundary

Sector: CLI discovery and local inventory

Status: `current` for the approved Apple Silicon macOS npm release

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
  memory, and show local runtime, model, AI-app, and AI-tool names; an explicitly
  created local share image may include the supported active tool product name,
  while saved HTML and anonymous/global artifacts remain aggregate-only;
- keep an owner-only local device journal containing the Mac display name, first
  scan time, last scan time, and scan count; never add the device name to a saved
  share page or anonymous/global payload;
- continuously monitor supported process trees at a one-second target interval,
  use repeated cumulative CPU-time deltas and hysteresis to distinguish Working
  now from Open / idle, and exclude the Forkit process tree and sleep gaps;
- keep that monitor owned by the local service so it survives window/browser
  closure until the user explicitly stops or quits;
- compare a browser-local numeric guess with the discovered model-record count;
- derive one to three deterministic local insights from valid measured time and
  keep explicit Stop/restart sessions separate for longest-block calculations;
- show clearly labelled supported-process CPU/memory context and separately
  measured Forkit CPU/RAM/history overhead without task attribution;
- expose a resource-evidence manifest that marks unsupported exclusive task
  attribution, GPU, and network traffic as unavailable instead of estimating;
- diagnose local AI Footprints readiness;
- prepare a consent-gated, aggregate-only anonymous contribution preview without
  transmitting it;
- package and publish the approved macOS-only release through npm;
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
- website or backend deployment from this standalone repository.

## Promotion gate

AI Footprints is public for Apple Silicon macOS only after founders intentionally
promote `docs/PRODUCTION_LOCK.md` in `arpitasarker01/forkit_dev_base`.

The standalone repository cannot broaden its own production scope. Forkit
Connect, website copy, privacy/legal review, package ownership, support
expectations, and release gates remain controlled by the Forkit.dev lock.
