# Validation

This document records reproducible release checks and bounded real-device
evidence. It is not a field-accuracy claim.

## Release checks

Run from a clean checkout on a supported Apple Silicon Mac:

```bash
npm ci
npm test
npm run benchmark:agents
npm run validate:macos
npm run smoke:package
npm run preflight:macos:release
npm run release:check
```

Latest local release check (2026-09-02): clean dependency install with zero
reported vulnerabilities, 136 automated tests passed, 68 detector fixtures
passed, isolated package smoke passed, and release-channel coherence passed.

| Check | Purpose | Boundary |
|---|---|---|
| `npm test` | Build, unit, lifecycle, persistence, privacy, and localization coverage | Automated behavior only |
| `benchmark:agents` | Conformance against labelled positive and negative detector fixtures | Not representative field accuracy |
| `validate:macos` | Stable real-device scans, loopback-only networking, and prohibited-key checks | One device is a release sanity check |
| `smoke:package` | Isolated packed-package install, import, and CLI smoke | Does not prove every host configuration |
| `preflight:macos:release` | Native launcher, bundle, architecture, and release prerequisites | Signing remains unavailable without Apple credentials |
| `release:check` | Version and release-channel coherence | Does not publish or deploy |

The CI matrix runs supported Node.js majors on macOS and performs an isolated
package smoke. Detector changes must add positive, negative, deduplication, and
privacy cases.

## Real-device release evidence

The v0.2.6 candidate was exercised on Apple Silicon macOS with supported AI apps
and an Ollama loopback runtime.

| Observation | Recorded result | Interpretation |
|---|---:|---|
| Recognized local models | 5 records; 2.60 GB logical storage | Recognized supported files, not whole-disk usage |
| Ollama runtime | Available; no model loaded | Runtime availability is not active inference |
| Long monitored session | 984.1 s valid; 982.9 s AI-active | Process-tree activity signal, not prompt or task ownership |
| Forkit overhead during that session | 1.3% median CPU; 3.3% p95 CPU; about 53.3 MB current RAM | Device-specific point-in-time evidence |
| Bundled-app session | 63.3 s valid; 62.1 s AI-active | Source-identical native bundle smoke |
| Community eligibility session | More than 600 valid seconds | Confirms the ten-minute contributor gate |

Lifecycle testing covered start, stop, inactive/locked pause, sleep-gap
exclusion, reconnect, window close with continued monitoring, reopen with the
same observation, restart with a new observation, and quit with no remaining
Forkit process or loopback listener.

User-interface checks covered English and German copy, interval inspection,
stable app colors, responsive sizing, share-image generation, clipboard/share
actions, and the one-page Forkit.dev installation and community Preview flow.

## Interpretation rules

- A passing detector corpus shows conformance to checked-in fixtures only.
- A passing real-device scan shows correct behavior on that tested device only.
- CPU and memory are process-tree evidence, not energy or cost measurements.
- Model storage is exact only for recognized files when supported-root coverage
  is complete.
- Community signatures prove integrity and continuity, not hardware uniqueness
  or measurement truth.

Representative multi-device evaluation is required before publishing a field
precision, recall, or accuracy percentage. See
[MACOS_ACCURACY_GATE.md](./MACOS_ACCURACY_GATE.md) for that protocol.
