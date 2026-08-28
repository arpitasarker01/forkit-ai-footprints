# Forkit AI Footprints Status

Last updated: 2026-08-28

Version: `0.2.4`

Production classification: `current` for Apple Silicon macOS

Release state: v0.2.4 npm-first community Preview candidate. The npm
bootstrap installs a persistent unsigned local app; Developer ID signing and
notarization remain future work.

## What is implemented

- One local experience: local AI-app activity first, deterministic personal
  insights, a user-initiated link to the Forkit global vision, a square aggregate
  share card, Scan again, and technical details. The link sends no observation
  payload.
- The protected local view names the current device and observation number,
  keeps the activity explorer on the left, and uses the right observation rail
  for pulse evidence, deterministic insights, runtime totals, live CPU/RAM,
  retained local aggregate resource history, recognized model space, verified
  local runtimes, and per-app filtering. GPU and per-app disk use remain
  explicitly unavailable rather than estimated.
- Four compact observation controls on the right switch the left explorer
  between pulse, runtime, resources, and per-app evidence. Hover text explains
  each control; selecting a pulse shows its exact local date/time, duration and
  state, while selecting an app filters the timeline and shows that app's
  measured runtime, contribution, first/last observation, current CPU/RAM, and
  retained local aggregate resource-history summary when available.
- The app shell uses responsive text sizing so labels, values, controls,
  timeline blocks, inspector cards, and detail rows scale with available window
  width instead of staying at tiny fixed pixel sizes.
- Explicit Start/Stop Monitoring with repeated one-second macOS process-tree
  sampling, cumulative CPU-time deltas, two-sample entry and three-sample exit
  hysteresis, and sleep-gap exclusion. Locked and unavailable time is excluded.
  Unlocked input-idle time remains excluded unless sustained supported AI work
  is still measured, so long-running agents do not disappear merely because the
  keyboard and pointer are untouched.
- One explicit Start-to-Stop run now keeps one stable observation identity.
  Sleep, lock, and inactivity create separate continuity periods without
  inventing new observations. Timeline intervals preserve every valid measured
  second across state changes, and filtered period counts use continuous blocks
  rather than raw render fragments.
- Clear states: **Active now**, **Ready**, **Monitoring**, and **Stopped**.
  Process presence alone never becomes active activity.
- Durations retain seconds at every scale, including observations longer than
  one hour.
- One to three deterministic insights from valid measured time: local AI-app
  activity share, longest continuous active block, supported-tool workflow,
  mostly-idle state, and stored local model records. Stop/restart boundaries
  cannot inflate the longest block.
- The monitor is owned by the local service, not a browser tab. Closing the
  window does not end a session; stopping preserves the summary; clearing is a
  separate explicit action.
- Service reconnect resumes the same observation without counting its offline
  gap. An explicit Stop followed by Start creates a clean new observation and
  never carries old totals, products, or timeline blocks into the new run.
- Detailed timeline, one-minute per-app resource buckets, and monitor-overhead
  samples remain bounded locally; cumulative observed and AI-active totals are
  maintained independently and are not reduced when old visual blocks age out.
- A persistent native AppKit/WebKit app installed into the current user's
  Applications folder by a one-time npm bootstrap. Later launches use normal
  macOS surfaces and do not require Terminal.
- A one-time native first-launch permission for aggregate global comparison,
  stored only in macOS user defaults. The in-app global action opens the public
  Forkit AI Footprint global vision section after the observation gate and does
  not transmit the local result.
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
- Supported AI-app resource history is retained locally only as bounded aggregate
  per-app buckets: observed/active seconds, average/peak CPU, average/peak RAM,
  peak process count, and sample count. It is not prompt/task attribution and is
  excluded from share/global payloads.
- Exact recognized logical model-file bytes for supported roots, with hard-link,
  symlink, overlapping-root, Hugging Face snapshot, and Ollama content-addressed
  deduplication.
- Verified Ollama availability requires the exact local listener owner, a valid
  version response, and a valid tags response. Loaded state comes only from a
  valid `/api/ps` response.
- A schema `2.0` Global AI Preview aggregate based on valid observed seconds and
  AI-active seconds. It excludes names, process counts, paths, commands, chat,
  workspace, device identity, guess, and local scan ID. Review and consent are
  separate. After explicit v2 native permission and one valid observed hour,
  the app signs and syncs the allowlisted aggregate to Forkit.dev, keeping one
  latest community-reported Preview row per stable local contribution key.
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
  valid time and **62.1 seconds** AI-active (ratio **0.981**). The deterministic
  evidence reports the supported app activity share, longest continuous signal,
  and stored local model records without attributing prompts or tasks.
- A separate earlier real session crossed the previous 10-minute gate at exactly
  **600 valid seconds** and **598 AI-active seconds**. The current global
  comparison requires **3,600 valid seconds** before a consented community
  Preview aggregate becomes eligible for sync.

## Validation completed locally

- TypeScript build and the complete local test suite: **130/130** tests passed.
- Deterministic active → idle/locked → resumed lifecycle coverage confirms that
  paused time changes neither observed nor AI-active seconds and cannot bridge
  the longest continuous activity block.
- Curated agent detector corpus: **68/68** fixtures, 30 positive and 38 negative,
  with zero fixture errors and fixture precision/recall/accuracy of 1.0. This is
  conformance evidence, not field accuracy.
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
- Real-browser QA in English and German for the Activity Explorer, interval
  evidence, reconnect persistence, stable system colors, correct GB/GiB labels,
  deterministic captions, 1080×1080 PNG export, image clipboard/share payloads,
  and the one-page Forkit.dev installation/global page.
- Forkit.dev production website build and registry AI Footprints route tests.

## Intentionally not enabled or not yet field-validated

- No verified global contribution/ranking, account, passport registry
  write, passport, Mint, Runtime_C2 write, or general telemetry. Only the
  explicitly consented community Preview aggregate transport is enabled.
- No Homebrew tap, signed direct download, or click installer.
- No Developer ID signature, notarization, stapling, Gatekeeper distribution
  test, or clean external-Mac installation test.
- No representative multi-device macOS field-accuracy result and no Intel Mac
  release claim.
- The live Mac reproduced the HID-idle paused state while monitoring remained
  active. The saved scorecard, timeline, insights, and stable system colors
  remained visible and unchanged through the paused state and reconnect.
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
storage or APFS physical allocation. **Active now** means sustained recent CPU
time in a supported local AI-app process tree and nothing more; it does not
claim that a cloud model is running locally.

## Smallest release gate

Future expansion requires representative multi-device field accuracy, Intel Mac
validation, and Apple signing/notarization. Community Preview contribution is
open under the v2 consent/integrity boundary; verified global ranking remains
closed until its separate hardware-verification and abuse-control gate passes.
