# Product Boundary

Sector: CLI discovery and local inventory

Status: `current` for the approved Apple Silicon macOS npm release

Forkit AI Footprints is the public name for the experimental metadata-only
inventory CLI. Its prepared package and only public command are
`forkit-ai-footprints`.

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
- keep an owner-only local device journal containing the local device display
  name, observation sequence, first scan time, last scan time, and scan count;
  use that identity only inside the protected local UI and never add it to a
  saved share page or anonymous/global payload;
- continuously monitor supported process trees at a one-second target interval,
  use repeated cumulative CPU-time deltas and hysteresis to distinguish Working
  now from Open / idle, and exclude the Forkit process tree and sleep gaps;
- keep that monitor owned by the local service so it survives window/browser
  closure until the user explicitly stops or quits;
- compare a browser-local numeric guess with the discovered model-record count;
- derive one to three deterministic local insights from valid measured time and
  keep explicit Stop/restart sessions separate for longest-block calculations;
- show clearly labelled supported-process current CPU/memory context, bounded
  local aggregate CPU/RAM history buckets per supported AI app, and separately
  measured Forkit CPU/RAM/history overhead without task attribution;
- keep the main activity explorer on the left and a local observation inspector
  on the right for measured runtime, current and retained aggregate CPU/RAM,
  recognized model space,
  verified runtimes, per-app activity filters, and per-app evidence; label GPU
  and per-app storage as unavailable when they are not measured or attributable;
- expose a resource-evidence manifest that marks unsupported exclusive task
  attribution, GPU, and network traffic as unavailable instead of estimating;
- diagnose local AI Footprints readiness;
- after a versioned native opt-in and ten valid observed minutes, transmit only the
  allowlisted aggregate to the fixed Forkit.dev Global AI Preview endpoint;
  sign the exact payload with a stable local Ed25519 key, retain one local
  receipt, and refresh no more than once per hour when internet is available;
- open the public Forkit AI Footprint global vision section only after an
  explicit user click; opening the page sends no local observation payload;
- package and publish the approved macOS-only release through npm;
- display optional cooperating-app chat/workspace metadata locally only; for
  Codex, read only the latest local catalog display title, recency, and project
  path, reduce the path to its final folder name, and keep that context in
  memory; never inspect window titles, prompts, responses, or command text;

Ubuntu, Windows, Android, and other operating systems are outside the current
support claim until separately validated and promoted.

## Explicitly excluded

- Forkit.dev authentication;
- passport draft creation or final Mint;
- registry writes;
- Runtime_C2 mutation or heartbeat;
- billing, plans, workspaces, or account state;
- telemetry outside the consented allowlisted Global AI Preview aggregate;
- remote endpoint inspection;
- mobile packaging;
- website or backend deployment from this standalone repository.

## Promotion gate

AI Footprints is public for Apple Silicon macOS only after founders intentionally
promote `docs/PRODUCTION_LOCK.md` in `arpitasarker01/forkit_dev_base`.

The standalone repository cannot broaden its own production scope. Forkit
Connect, website copy, privacy/legal review, package ownership, support
expectations, and release gates remain controlled by the Forkit.dev lock.
