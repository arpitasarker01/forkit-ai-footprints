# Forkit AI Footprints Status

Last updated: 2026-08-23

Version: `0.2.0`

Production classification: `current` for Apple Silicon macOS

Release state: founder-approved public v0.2.0 npm-first release. The npm
bootstrap installs a persistent unsigned local app; Developer ID signing and
notarization remain future work.

## What is implemented

- One local experience: AI activity first, deterministic personal insights,
  optional global comparison with exact payload review, a square aggregate share
  card, Scan again, and technical details.
- Explicit Start/Stop Monitoring with repeated one-second macOS process-tree
  sampling, cumulative CPU-time deltas, two-sample entry and three-sample exit
  hysteresis, and sleep-gap exclusion.
- Clear states: **Working now**, **Open / idle**, **Not running**, and **Stopped**.
  Process presence alone never becomes working activity.
- One to three deterministic insights from valid measured time: activity share,
  longest continuous active block, supported-tool workflow, mostly-idle state,
  and available-but-unused local models. Stop/restart boundaries cannot inflate
  the longest block.
- The monitor is owned by the local service, not a browser tab. Closing the
  window does not end a session; stopping preserves the summary; clearing is a
  separate explicit action.
- A persistent native AppKit/WebKit app installed into the current user's
  Applications folder by a one-time npm bootstrap. Later launches use normal
  macOS surfaces and do not require Terminal.
- A native AppKit/WebKit window and retained menu-bar controller with Open,
  Start/Stop, and Quit actions. Closing hides the window without quitting; Quit
  stops the service and has a process-exit fallback so the bundled Node service
  cannot remain orphaned.
- One English/German localization source drives the app, deterministic insights,
  share caption, menu-bar menu, and close/quit notices.
- Local-only optional workflow/project display. Cooperating apps may explicitly
  supply it; Codex can also use its most recent private local catalog title and
  project folder basename. No window-title, prompt, response, or command-text
  inspection is attempted, and the context never enters share/global artifacts.
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
- A 1080×1080 local share card with Share, Save PNG, Copy Image, and Copy
  Caption controls. It contains only measured totals and supported tool names.
- A single Forkit.dev `/ai-footprint` page with an honest benchmark-forming
  state and one npm path using `npx --yes forkit-ai-footprints@latest`.
  Unpublished Forkit Homebrew/download channels are not claimed.
- One release version sourced from `package.json`, release-coherence checks,
  package smoke tooling, a bundled official Node runtime, official Forkit app
  and menu-bar assets, and an unsigned local `.app`/`.pkg` candidate.

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
- A final source-identical bundled-app observation reached **63.3 seconds** of
  valid time and **62.1 seconds** AI-active (ratio **0.981**), producing: “Codex
  was working during 98% of your observation.”, “Your longest continuous
  AI-active period was 1m 1s.”, and “5 local models are available, but none ran
  during this observation.”
- A separate real session crossed the 10-minute gate at exactly **600 valid
  seconds** and **598 AI-active seconds**. Only then did the local comparison
  preview become available; no transport was enabled.

## Validation completed locally

- TypeScript build and the complete local test suite.
- Curated agent detector corpus: **58/58** fixtures, 26 positive and 32 negative,
  with zero fixture errors. This is conformance evidence, not field accuracy.
- Isolated packed-package installation/import/CLI smoke.
- Native Swift compilation, bundled CLI/version smoke, bundled official Node
  checksum, App Attest capability probe, and unsigned `.app`/`.pkg` build.
- Real native 1120×787 window creation, visible-on-reveal menu-bar item, menu
  Start, window close with continued monitoring, reopen with the same timeline,
  Stop, restart, and monitoring-state Quit with zero remaining Forkit process or
  loopback listener on this Mac.
- Accessibility evidence placed the retained 24×24 status item at `y=-59` while
  macOS auto-hid the menu bar and at `y=3` after revealing the bar. Its help text
  was “Forkit AI Footprint” and its complete localized menu was exposed.
- Real-browser QA in English and German for the local monitor, Guess → Reveal,
  correct GB/GiB labels, deterministic captions, 1080×1080 PNG export, image
  clipboard/share payloads, and the one-page Forkit.dev installation/global page.
- Forkit.dev production website build and registry AI Footprints route tests.

## Intentionally not enabled or not yet field-validated

- No upload, verified global contribution, public ranking, account, registry
  write, passport, Mint, Runtime_C2 write, telemetry, or production deployment.
- No Homebrew tap, signed direct download, or click installer.
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

Future expansion requires representative multi-device field accuracy, Intel Mac
validation, and Apple signing/notarization. Global contribution remains closed
until its separate server-side verification and abuse-control gate passes.
