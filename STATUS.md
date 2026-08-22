# Forkit Census Status

Last updated: 2026-08-22

Version: `0.1.0`

Status: local MVP implementation complete; release classification `future/investigate`

## Implemented

- independent package and `forkit-census` executable;
- explicit package-root shared-core API with TypeScript declarations and an
  isolated consumer smoke test;
- unified runtime, model-file, and agent scan;
- Ollama, LM Studio, and loopback OpenAI-compatible providers;
- Ollama `/api/ps` confirmed-running model evidence;
- Ollama content-addressed identity when the runtime exposes a digest;
- metadata-only filesystem model identity;
- exact-token agent signatures;
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
- hosted cross-platform CI definition.

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

Current local validation for the handoff-completion feature branch on
macOS/arm64 with Node 24:

- `npm ci`: pass; zero reported vulnerabilities;
- `npm test`: 30/30 pass;
- curated agent detector benchmark: 53/53 cases pass (25 positive, 28 negative,
  zero false positives, zero false negatives, zero wrong classifications);
- `npm run smoke:package`: pass;
- `forkit-census doctor --json`: pass;
- real-device unified Census with runtime/model/agent/tool/MCP/guess output: pass;
- privacy scan of the real report: no home-directory, Windows-user-path,
  API-key-prefix, API-key-flag, or session-token leak found.

The real-device census aggregated 18 Codex-related processes into one Codex
product and did not reproduce Forkit Connect's prior `Agno Tooling` false
positive. This is encouraging evidence, not an accuracy benchmark.

Hosted GitHub Actions validation for implementation commit `239005b`:

- Node 20, 22, and 24 test/package inspection: 9/9 pass across Ubuntu, macOS,
  and Windows;
- isolated installed-package smoke: 3/3 pass across Ubuntu, macOS, and Windows;
- workflow conclusion: success ([run 32583418237](https://github.com/arpitasarker01/forkit-census/actions/runs/32583418237)).

This proves the tested package and CLI paths work on the supported hosted runner
matrix. The curated benchmark measures conformance against its labeled fixtures,
not precision or recall across a representative field-device corpus.

Hosted GitHub Actions validation for handoff-completion commit `b5ae91e`:

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
- keep npm publication and production promotion as separate approvals.

The npm name `forkit-census` returned `E404` on 2026-08-22 and therefore appears
unpublished. Availability is not ownership and must be rechecked immediately
before any separately authorized publication.
