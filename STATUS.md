# Forkit Census Status

Last updated: 2026-08-22

Version: `0.1.0`

Status: macOS accuracy hardening in progress; release classification `future/investigate`

## Implemented

- independent package and `forkit-census` executable;
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
- human and JSON reports;
- passive AI-tool and MCP configuration detection;
- storage buckets, guess comparison, verbose and native clipboard modes;
- a separately consented aggregate-only contribution preview with no uploader;
- loopback-only endpoint enforcement;
- doctor command;
- local unit and isolated package-smoke tooling;
- packaged local macOS field evaluator that emits aggregate metrics only;
- offline multi-result aggregation with coverage strata and Wilson 95%
  confidence intervals;
- macOS-only hosted CI definition and real-device validation command.

## Intentionally absent

- login and account state;
- passport draft or Mint actions;
- Forkit.dev registry writes;
- Runtime_C2 mutation;
- remote telemetry;
- Global Census network transport or comparison backend;
- model byte reads;
- raw command/path output;
- npm publication;
- production promotion.

## Validation state

Current local validation for the macOS hardening branch on macOS/arm64:

- `npm ci`: pass; zero reported vulnerabilities;
- `npm test`: 45/45 pass on Node 20, 22, and 24;
- curated agent detector benchmark: 58/58 cases pass (26 positive, 32 negative,
  zero false positives, zero false negatives, zero wrong classifications);
- `npm run smoke:package`: pass;
- packaged `forkit-census evaluate --truth ...`: pass; aggregate-only result,
  no labelled item names, no upload, and no accuracy-claim authorization;
- `forkit-census doctor --json`: pass;
- repeated real-device unified Census with stable item sets: pass;
- real-device loopback guard: 12 loopback requests across two scans, zero
  external requests;
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
- approve a Global Census schema, privacy policy, endpoint, retention policy,
  and comparison response before adding any uploader;
- choose the experimental distribution and support policy;
- obtain a separately labelled, consented multi-device macOS evaluation before
  making any field-accuracy claim;
- validate Intel Mac separately before adding it to the support claim;
- keep npm publication and production promotion as separate approvals.

The npm name `forkit-census` returned `E404` on 2026-08-22 and therefore appears
unpublished. Availability is not ownership and must be rechecked immediately
before any separately authorized publication.
