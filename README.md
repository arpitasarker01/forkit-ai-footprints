# Forkit AI Footprints

[![CI](https://github.com/arpitasarker01/forkit-ai-footprints/actions/workflows/ci.yml/badge.svg)](https://github.com/arpitasarker01/forkit-ai-footprints/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/forkit-ai-footprints)](https://www.npmjs.com/package/forkit-ai-footprints)
[![License: MIT](https://img.shields.io/badge/License-MIT-2f2361.svg)](./LICENSE)

Forkit AI Footprints shows when supported AI tools are active on a device, how
long they stay active, and which local AI models are available. Monitoring is
local by default. Joining the community Preview is optional.

[Product](https://www.forkit.dev/ai-footprint) ·
[npm](https://www.npmjs.com/package/forkit-ai-footprints) ·
[Releases](https://github.com/arpitasarker01/forkit-ai-footprints/releases) ·
[Support](./SUPPORT.md) · [Contributing](./CONTRIBUTING.md) ·
[Security](./SECURITY.md)

> **Platform support:** the current release supports Apple Silicon macOS.
> Other platforms are not yet supported.

## Install

```bash
npx --yes forkit-ai-footprints@latest
```

The bootstrap installs the persistent app in the current user's Applications
folder and opens it. Later launches use Applications, Spotlight, the Dock, or
the Forkit menu-bar icon. Run the same command again to update.

The bootstrap requires Node.js 20, 22, or 24. A signed direct download and
Homebrew formula are not currently available. See the
[distribution policy](./docs/GLOBAL_DISTRIBUTION.md).

## What it shows

- **AI activity timeline** — working, ready, paused, and excluded intervals for
  supported AI applications.
- **Observation summary** — valid observed time, AI-active time, longest active
  block, and supported tools observed.
- **Per-app evidence** — measured runtime plus current and bounded local
  aggregate CPU and memory summaries.
- **Local AI footprint** — recognized local model records, logical storage, and
  supported runtime loaded-state evidence.
- **Share image** — a local 1080×1080 summary containing measured totals and
  supported tool names only.
- **Community Preview** — an optional, consented comparison using an allowlisted
  anonymous aggregate.

Forkit does not infer prompts, tasks, tokens, cost, energy, or model ownership
from process activity. GPU and per-app storage attribution are not measured.

## Measurement boundary

| Signal | What it means | Important limit |
|---|---|---|
| AI-active | Sustained recent CPU-time change in a supported AI-app process tree | Not prompt, task, or token attribution |
| Ready | A supported app is present without sustained measured activity | Presence alone is never counted as active |
| Valid observed time | Time while the device is awake, unlocked, and eligible for observation | Locked, stopped, sleep-gap, and excluded time do not count |
| CPU and memory | Current process-tree readings and bounded local aggregate summaries | Not energy, cost, or exclusive workload ownership |
| Local model storage | Logical bytes for recognized files inside supported roots | Not whole-disk or physical APFS usage |
| Loaded local model | Provider-confirmed loaded state from a supported local runtime | Availability alone does not mean a model is running |

Detector rules are conservative and reviewable. A curated conformance corpus is
not a representative field-accuracy study. See the
[measurement foundation](./docs/MACOS_MEASUREMENT_FOUNDATION.md) and
[validation record](./docs/VALIDATION.md).

## Privacy

The app is metadata-only and private by default.

It does not inspect prompts, responses, or model contents; collect credentials
or account identity; or retain or upload raw commands, full paths, or the local
device name. Runtime inspection is restricted to approved loopback endpoints.

The protected local app may display supported tool names and limited local
context. That context is excluded from share images, saved reports, and the
community payload. Read the complete [privacy boundary](./PRIVACY.md) before
changing any collection, persistence, or network behavior.

## Community Preview

Nothing is sent before the user accepts the separate v3 contribution notice.
After consent and ten valid observed minutes, the app may send one signed,
allowlisted aggregate and refresh that installation's latest row no more than
once per hour when internet is available.

An **active contributor** is an opted-in installation that has reached the
ten-minute gate and successfully synced. Downloads are reported separately and
do not represent people, installations, or contributors.

The public AI-active rate is duration-weighted:

```text
sum(AI-active seconds) / sum(valid observed seconds)
```

Personal percentile placement remains unavailable until there are at least 30
eligible contributors with one valid observed hour each. Community signatures
prove payload integrity and continuity, not unique hardware or truthful
measurement. The public result is therefore labelled **Preview** and
**community-reported**.

See [PRIVACY.md](./PRIVACY.md) for the exact payload allowlist and exclusions.

## Common commands

```bash
forkit-ai-footprints serve
forkit-ai-footprints monitor
forkit-ai-footprints scan
forkit-ai-footprints doctor
forkit-ai-footprints --version
```

Advanced local evaluation and field-testing commands are documented in the
[macOS tester guide](./docs/MACOS_TESTER_GUIDE.md). Truth files and evaluation
results remain local unless a tester explicitly chooses to share an aggregate.

## Development

Requirements: Apple Silicon macOS, Node.js 20/22/24, and npm.

```bash
git clone https://github.com/arpitasarker01/forkit-ai-footprints.git
cd forkit-ai-footprints
npm ci
npm test
npm run smoke:package
```

Detector changes require positive, negative, deduplication, and privacy tests.
Changes to collection, persistence, network destinations, consent, or packaging
require explicit product-boundary and maintainer review.

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. For
installation help or bug reports, see [SUPPORT.md](./SUPPORT.md). Report
security or privacy vulnerabilities privately as described in
[SECURITY.md](./SECURITY.md).

## Project documentation

- [Current release status](./STATUS.md)
- [Privacy boundary](./PRIVACY.md)
- [Product boundary](./docs/PRODUCT_BOUNDARY.md)
- [Validation record](./docs/VALIDATION.md)
- [Release process](./docs/RELEASE_PROCESS.md)
- [Global distribution](./docs/GLOBAL_DISTRIBUTION.md)

## License

Forkit AI Footprints is available under the [MIT License](./LICENSE).
