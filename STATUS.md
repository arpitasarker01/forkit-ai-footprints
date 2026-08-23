# Forkit AI Footprints Status

Last updated: 2026-08-23

Version: `0.2.0`

Production classification: `future/investigate`

Release state: complete local macOS/Apple Silicon candidate; not published,
pushed, deployed, signed, notarized, or production-promoted.

## What is implemented

- One local experience: AI activity first, Guess → Reveal, an aggregate share
  card, optional exact global-payload review, Scan again, and technical details.
- Explicit Start/Stop Monitoring with repeated one-second macOS process-tree
  sampling, cumulative CPU-time deltas, two-sample entry and three-sample exit
  hysteresis, and sleep-gap exclusion.
- Clear states: **Working now**, **Open / idle**, **Not running**, and **Stopped**.
  Process presence alone never becomes working activity.
- The monitor is owned by the local service, not a browser tab. Closing the
  window does not end a session; stopping preserves the summary; clearing is a
  separate explicit action.
- A native AppKit/WebKit window and menu-bar controller with Show, Start/Stop,
  and Quit actions. Quit stops the service and has a process-exit fallback so
  the bundled Node service cannot remain orphaned.
- Local-only optional chat/workspace display when a cooperating app explicitly
  supplies those values. No inference from window titles, folders, prompts, or
  commands is attempted.
- Forkit's own process tree is excluded from detected AI activity. Its CPU,
  RAM, and bounded-history overhead are measured and labelled separately.
- Exact recognized logical model-file bytes for supported roots, with hard-link,
  symlink, overlapping-root, Hugging Face snapshot, and Ollama content-addressed
  deduplication.
- Verified Ollama availability requires the exact local listener owner, a valid
  version response, and a valid tags response. Loaded state comes only from a
  valid `/api/ps` response.
- A schema `2.0` candidate global aggregate based on valid observed seconds and
  AI-active seconds. It excludes names, process counts, paths, commands, chat,
  workspace, device identity, guess, and Census ID. Review and consent are
  separate; upload transport remains disabled.
- A single Forkit.dev AI Footprints page with an honest unavailable/prelaunch
  state, a verified global-pulse design, and three macOS paths leading to the
  same future `npx --yes forkit-ai-footprints@latest` command. Unpublished
  Forkit Homebrew/download channels are not claimed.
- One release version sourced from `package.json`, release-coherence checks,
  package smoke tooling, a bundled official Node runtime, and an unsigned local
  `.app`/`.pkg` candidate.

## Evidence from this Apple Silicon Mac

- Models discovered: **5**.
- Models loaded: **0**.
- Recognized model storage: **2,600,071,742 bytes** (**2.60 GB / 2.42 GiB**)
  across **12** deduplicated recognized files with complete supported-root
  coverage.
- Verified local runtime: **Ollama 0.20.5**, owned by the exact Homebrew
  `ollama` executable on `127.0.0.1:11434`.
- Ollama inventory: `llama3.2:latest`; `/api/ps` was empty. The correct state is
  **engine available, no model loaded**, not AI work.
- A real **984.1-second** valid session observed Codex activity for **982.9
  seconds** (ratio **0.999**) while this development task was actively running.
  This is real process-tree activity evidence, not prompt/task/token ownership.
- During the measured session, Forkit overhead was **1.3% median CPU**, **3.3%
  p95 CPU**, about **53.3 MB current RAM**, **117.1 MB maximum RAM**, and **627
  bytes** of bounded serialized history at the final payload sample.

## Validation completed locally

- TypeScript build and the complete local test suite.
- Curated agent detector corpus: **58/58** fixtures, 26 positive and 32 negative,
  with zero fixture errors. This is conformance evidence, not field accuracy.
- Isolated packed-package installation/import/CLI smoke.
- Native Swift compilation, bundled CLI/version smoke, bundled official Node
  checksum, App Attest capability probe, and unsigned `.app`/`.pkg` build.
- Real native 1120×786 window creation, monitor start, service ownership, and
  stopped-state clean quit on this Mac.
- Real-browser QA for the local monitor, Guess → Reveal, correct GB/GiB labels,
  share-card dialog, and the one-page Forkit.dev installation/global-state page.
- Forkit.dev production website build and registry AI Footprints route tests.

## Intentionally not enabled or not yet field-validated

- No upload, verified global contribution, public ranking, account, registry
  write, passport, Mint, Runtime_C2 write, telemetry, or production deployment.
- No npm publication, Homebrew tap, GitHub Release, public download, or website
  availability claim.
- No Developer ID signature, notarization, stapling, Gatekeeper distribution
  test, or clean external-Mac installation test.
- No representative multi-device macOS field-accuracy result and no Intel Mac
  release claim.
- App Attest reports unsupported on this macOS 26 device, so this Mac cannot
  produce a verified global contribution under the proposed proof policy.
- No prompt, task, token, energy, cost, GPU, disk-I/O, or per-process network
  attribution.

## Accuracy boundary

The detector is deliberately conservative. Exact executable/module/package
runner matches and verified runtime identities are strong implementation rules,
but one real Mac and a curated fixture corpus cannot establish a global
precision/recall percentage. Model storage is exact only for recognized files
inside supported roots when `storage_complete=true`; it is not whole-disk AI
storage or APFS physical allocation. **Working now** means sustained recent CPU
time in a supported process tree and nothing more.

## Smallest release gate

Founder review should approve the local UI wording, schema `2.0` allowlist, and
unsigned npm-first distribution candidate. After that, run the final clean-tree
release suite, publish the exact tested package through founder-controlled npm
trusted publishing, verify the registry version, and only then mark the website
channel available. Apple signing remains a later independent gate.
