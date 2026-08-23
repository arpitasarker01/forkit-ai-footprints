# Forkit AI Footprints Status

Public product name: **Forkit AI Footprints**. Prepared package and executable:
`forkit-ai-footprints`. Temporary compatibility binary: `forkit-census`.

Last updated: 2026-08-23

Version: `0.2.0`

Status: macOS accuracy hardening in progress; release classification `future/investigate`

## Implemented

- independent package and `forkit-ai-footprints` executable;
- token-protected `127.0.0.1` local UI with Guess → Actual and Scan again;
- focused Discover, Observe, and Evolution views;
- optional browser-local history capped at 12 aggregate snapshots, with
  deterministic AI Curious → AI Orchestrator chapters and a clear-history action;
- token-protected `Close local scan` action for the packaged-app lifecycle;
- explicit package-root shared-core API with TypeScript declarations and an
  isolated consumer smoke test;
- unified runtime, model-file, and agent scan;
- Ollama, LM Studio, and loopback OpenAI-compatible providers;
- Ollama `/api/ps` confirmed-running model evidence;
- Ollama content-addressed identity when the runtime exposes a digest;
- metadata-only filesystem model identity;
- executable/module/package-runner agent evidence with arbitrary argument-token
  matches rejected;
- a labeled agent-process conformance corpus with positive and difficult
  negative cases;
- product-level agent deduplication with process instance counts;
- point-in-time aggregate CPU and memory percentages for strongly classified
  agent processes, with no per-process details retained in the report;
- human and JSON reports;
- passive AI-tool and MCP configuration detection;
- exact recognized model-file bytes, guess comparison, verbose and native clipboard modes;
- user-started task observation with in-memory average/peak detected-agent CPU
  and memory samples, duration, sample count, and explicit shared-process limits;
- a separately consented aggregate-only contribution preview with no uploader;
- loopback-only endpoint enforcement;
- doctor command;
- local unit and isolated package-smoke tooling;
- packaged local macOS field evaluator that emits aggregate metrics only;
- offline multi-result aggregation with coverage strata and Wilson 95%
  confidence intervals;
- self-contained aggregate-only local HTML share page with explicit copy/native
  share controls and no automatic network activity;
- browser-generated 1200×630 Guess → Discovered PNG with local download and
  native share actions, dynamic result-based language, defensible resource
  snapshots, aggregate fields only, and no external assets;
- discovery, observed-task, and evolution share-card narratives;
- local 36 MB Apple Silicon `.pkg` candidate with a checksummed official Node
  runtime bundled, app/CLI smoke, and valid ad-hoc app signature;
- macOS-only hosted CI definition and real-device validation command.
- separately labelled controlled-compatibility CI for macOS 14, 15, and 26 on
  Apple Silicon plus macOS 15 on Intel; these runs are not field evidence.

## Intentionally absent

- login and account state;
- passport draft or Mint actions;
- Forkit.dev registry writes;
- Runtime_C2 mutation;
- remote telemetry;
- enabled Global AI Footprints contribution transport;
- Developer ID-signed, Apple-notarized, stapled installer;
- model byte reads;
- raw command/path output;
- npm publication;
- production promotion.
- per-prompt attribution, GPU use, energy, tokens, cost, disk I/O, or network
  attribution; the current task window does not claim these measurements.

## Validation state

Current local validation for the macOS hardening branch on macOS/arm64:

- `npm ci`: pass; zero reported vulnerabilities;
- `npm test`: 52/52 pass locally; hosted Node 20, 22, and 24 validation passes
  for implementation commit `b482ccd`;
- curated agent detector benchmark: 58/58 cases pass (26 positive, 32 negative,
  zero false positives, zero false negatives, zero wrong classifications);
- `npm run smoke:package`: pass;
- packaged `forkit-ai-footprints evaluate --truth ...`: pass; aggregate-only result,
  no labelled item names, no upload, and no accuracy-claim authorization;
- `forkit-ai-footprints doctor --json`: pass;
- repeated real-device unified Census with stable item sets: pass;
- real-device loopback guard: 12 loopback requests across two scans, zero
  external requests;
- real-device resource snapshot: 4 model records, 0 loaded models, exactly
  2,595,045,761 recognized model-file bytes, 1 active agent product across 14 processes; CPU and
  memory percentages are explicitly point-in-time;
- real-browser user-timed observation: 7 local samples over 5.8 seconds with
  average/peak detected-agent CPU and peak memory rendered into the share card;
  this validates the flow, not exclusive attribution to one prompt;
- native app bundle launch and bundled-runtime CLI smoke: pass; package remains
  unsigned and non-distributable;
- real-browser Guess → Discovered, local rescan, caption copy, and 1200×630 PNG
  download: pass on the same Apple Silicon Mac;
- hosted package smoke and controlled macOS 14/15/26 Apple Silicon plus macOS
  15 Intel compatibility checks: 8/8 pass for implementation commit `b482ccd`;
- privacy scan of the real report: no home-directory, Windows-user-path,
  API-key-prefix, API-key-flag, or session-token leak found.

The hardened real-device census reports one high-confidence Codex product using
exact executable evidence. It rejects reproduced false positives from unrelated
`grep codex` arguments and paths containing `claude`. This is encouraging
evidence from one Apple Silicon Mac, not a field-accuracy benchmark.

Historical hosted GitHub Actions validation for implementation commit `239005b`:

- Node 20, 22, and 24 test/package inspection: 9/9 pass across Ubuntu, macOS,
  and Windows;
- isolated installed-package smoke: 3/3 pass across Ubuntu, macOS, and Windows;
- workflow conclusion: success ([run 32583418237](https://github.com/arpitasarker01/forkit-census/actions/runs/32583418237)).

Those historical runs prove the earlier package paths executed on those hosted
runners. They are no longer a Windows or Ubuntu release claim. The active scope
is macOS only, and the curated benchmark still does not measure precision or
recall across representative field devices.

Historical hosted GitHub Actions validation for handoff-completion commit `b5ae91e`:

- Node 20, 22, and 24 test/package inspection: 9/9 pass across Ubuntu, macOS,
  and Windows;
- isolated installed-package smoke: 3/3 pass across Ubuntu, macOS, and Windows;
- workflow conclusion: success ([run 32587498034](https://github.com/arpitasarker01/forkit-census/actions/runs/32587498034)).

## Remaining product decisions

- complete founder review of the product boundary;
- integrate `forkit-connect census` against this canonical package after an
  approved package/promotion sequence, removing the temporary duplicated core;
- approve a Global AI Footprints schema, privacy policy, endpoint, retention policy,
  and comparison response before adding any uploader;
- choose the experimental distribution and support policy;
- obtain a separately labelled, consented multi-device macOS evaluation before
  making any field-accuracy claim;
- validate Intel Mac separately before adding it to the support claim;
- keep npm publication and production promotion as separate approvals.

The npm name `forkit-ai-footprints` returned `E404` on 2026-08-22 and therefore appears
unpublished. Availability is not ownership and must be rechecked immediately
before any separately authorized publication.
