# Forkit AI Footprints

Forkit AI Footprints is a private, metadata-only view of the models, runtimes,
and AI agents present on a Mac. The prepared package and command are
`forkit-ai-footprints`.

It is derived from the discovery lessons in Forkit Connect, but it has a
different safety boundary: AI Footprints does not authenticate to Forkit.dev and has
no passport, Mint, registry-write, Runtime_C2-write, or production deployment
path.

Product status: `current` for the approved Apple Silicon macOS release

Current support target: **macOS only**. The real-device validation so far is on
Apple Silicon. Ubuntu, Windows, Android, and Intel Mac are not part of the
current release claim.

## Install on macOS

The free global installation command is:

```bash
npx --yes forkit-ai-footprints@latest
```

Mac users who already have Node can run it directly. Homebrew users can first
run `brew install node`; users with neither can use the official Node LTS
installer and verify `node`, `npm`, and `npx`. A Forkit-specific Homebrew formula
and direct download are deliberately not advertised because those channels do
not exist. The website presents the command only when the exact tested package
and release metadata agree. See
[`docs/GLOBAL_DISTRIBUTION.md`](./docs/GLOBAL_DISTRIBUTION.md).

The future click installer remains blocked until it can be Developer ID-signed
and Apple-notarized. Developers can build the local candidate with:

```bash
npm ci
npm run preflight:macos:release
npm run build:macos:installer
```

The current output is an unsigned local validation artifact because no valid
Developer ID Application or Installer identity is available on this Mac. It
must not be distributed until signing, notarization, stapling, Gatekeeper
verification, and clean-Mac installation tests pass.

### Developer fallback

Requirements:

- macOS;
- Node.js 20, 22, or 24
- npm

```bash
git clone https://github.com/arpitasarker01/forkit-ai-footprints.git
cd forkit-ai-footprints
npm ci
npm pack
npm install -g ./forkit-ai-footprints-0.2.4.tgz
forkit-ai-footprints serve
```

The equivalent persistent global CLI installation is:

```bash
npm install -g forkit-ai-footprints
forkit-ai-footprints serve
```

npm is the approved public bootstrap channel for this release. Homebrew remains
a future optional channel.

## Commands

Run a local scan, verify the installation, or score one manually labelled Mac:

```bash
forkit-ai-footprints serve
forkit-ai-footprints monitor
forkit-ai-footprints scan
forkit-ai-footprints doctor
forkit-ai-footprints evaluate --truth /absolute/path/to/local-truth.json
forkit-ai-footprints aggregate --results /absolute/path/to/evaluation-results
forkit-ai-footprints share-page --output /absolute/path/to/local-ai-footprint.html
```

`evaluate` always runs locally and emits aggregate counts and metrics only. It
does not upload the truth file or include its item names in the output.

Create the truth file only after manually checking that Mac. Empty arrays are
valid when a surface is not installed or running:

```json
{
  "schema_version": "1.0",
  "expected": {
    "agent_signatures": ["codex"],
    "tool_names": ["Codex"],
    "online_runtime_names": ["ollama"],
    "model_keys": ["ollama:example-model:latest"],
    "mcp_clients": ["Codex"]
  }
}
```

Keep truth files local; model names and installed-tool labels may be private.
The evaluation result adds only macOS major version, CPU architecture, Node
major, and aggregate counts. A coordinator can combine explicitly shared result
files with `aggregate`; this remains local and always keeps automatic accuracy
claims disabled. See [`docs/MACOS_TESTER_GUIDE.md`](./docs/MACOS_TESTER_GUIDE.md).

`share-page` performs the same local scan and writes a self-contained,
aggregate-only HTML snapshot. It loads no external assets and contains no model
names, paths, commands, endpoints, configuration values, account identity, or
local scan ID. Its copy/share controls include only the visible aggregate summary
and run only after a user click.

`serve` binds only to `127.0.0.1`, keeps the report and monitor in memory, and
opens the local AI-app activity → Insights → Global vision → Share experience. `Scan again` calls a random-token-protected local
endpoint. The protected local page can name detected runtimes, models, AI apps,
and tools. The explicitly created local share image may include the supported
active tool product name; saved HTML and anonymous/global payloads remain
aggregate-only.
Start/Stop controls monitoring explicitly; browser/window closure does not stop
it, while native Quit stops the monitor and loopback service.

The local app also keeps an owner-only device journal containing the sanitized
Mac display name, first/last scan timestamps, and scan count. This lets the Mac
resume its local state without placing the device name in a report, saved share
page, image, anonymous preview, or website payload. The single result view uses
a token-protected local stream with a one-second target interval. Repeated
cumulative CPU-time deltas and hysteresis distinguish Active now from Ready;
process presence alone is never activity. It is near-real-time, not zero delay.

For Codex, the local view can also show the most recent workflow title and the
final folder name from Codex's private local catalog. This is contextual local
metadata, not prompt inspection or per-workflow resource attribution. It never
enters the share image, caption, saved share page, or global payload.

The revealed resource view reports deduplicated recognized logical model-file
bytes, provider-native loaded-model evidence, current supported-process CPU/RAM,
and bounded per-AI-app aggregate CPU/RAM history buckets retained locally for the
observation. The activity view uses private process-tree CPU-time deltas and
separately displays Forkit's measured CPU, resident memory, and bounded-history
overhead. None is an energy, token, cost, prompt, task, or lifetime-usage
measurement.

AI Footprints does not claim prompt, task, or local-model inference ownership.
**Active now** means sustained recent CPU time inside a supported local AI-app
process tree, which may be foreground or background. The result does not
measure GPU, energy, tokens, cost, disk I/O, or per-process network usage.

`Create share card` renders a 1080×1080 (1:1) PNG entirely on the device. Its
result-based line and cards use measured local insights,
model-record count, recognized model storage, activity ratio, and the supported
active tool product name. Browser controls download or copy it; the installed
app uses native macOS save, clipboard, and share-sheet actions after an explicit
click. No model names, chat/workspace
context, paths, device identity, or scan records are placed in the image or
uploaded by AI Footprints.

```bash
forkit-ai-footprints serve
forkit-ai-footprints scan
forkit-ai-footprints scan --json
forkit-ai-footprints scan --verbose --guess 5
forkit-ai-footprints scan --copy
forkit-ai-footprints report --json --output footprint.json
forkit-ai-footprints scan --model-dir /path/you/selected
forkit-ai-footprints doctor
forkit-ai-footprints --version
```

One `scan` includes runtime APIs, filesystem model metadata, and agent process
metadata by default. Individual surfaces can be disabled:

```bash
forkit-ai-footprints scan --no-runtimes
forkit-ai-footprints scan --no-model-files
forkit-ai-footprints scan --no-agents
forkit-ai-footprints scan --no-tools
forkit-ai-footprints scan --no-mcp
```

CLI flags cannot bypass the required monitoring session. The local UI enables
an exact schema `2.0` aggregate preview only after 3,600 valid observed seconds;
the installed app asks with versioned consent whether the anonymous aggregate
may join the Global AI Preview. When allowed, the app sends one latest signed
aggregate after the one-hour gate and refreshes it when internet is available. The
payload excludes app/model names, process counts, CPU/RAM, chat, workspace,
repository, device, guess, local scan, and account identifiers.

## Shared core API

Forkit Connect should delegate to this package's public, read-only core rather
than copy its detector implementation. The package root exports the local scan
runner, individual metadata detectors, formatters, provider adapters, endpoint
validation, anonymous-preview builder, and TypeScript types. A fresh-install
smoke test imports the package root and verifies that an all-disabled core scan
makes zero external requests and writes no local state.

## What AI Footprints reports

- availability of supported loopback runtime APIs;
- model names and provider identities;
- models confirmed loaded by Ollama's read-only `/api/ps` response;
- Ollama content digests when exposed by the runtime;
- metadata-only fingerprints for supported local model files;
- known AI agent products with process-instance counts;
- passively configured or active Claude Code, Codex, Cursor, Windsurf, Gemini
  CLI, GitHub Copilot, OpenCode, and OpenClaw surfaces;
- aggregate server counts from known MCP client configuration files;
- exact recognized logical model-file bytes when supported-root coverage is
  complete, plus explicit completeness evidence and optional guess comparison;
- confidence labels and review warnings;
- platform, architecture, and Node major version.

## What AI Footprints does not collect

- model weights or file contents;
- prompts or responses;
- raw process commands;
- full model paths in reports;
- credentials, tokens, API keys, or passwords;
- device name or hostname in reports, saved/shareable artifacts, anonymous
  previews, or website payloads; username, email address, and account identity
  are never collected.

AI Footprints only connects to loopback HTTP(S) endpoints. Remote hosts and URLs with
embedded credentials are rejected.

Known MCP configuration files are read only to count configured server entries.
Server names, commands, URLs, environment variables, and values are neither
retained nor emitted.

See [`PRIVACY.md`](./PRIVACY.md), [`STATUS.md`](./STATUS.md), and
[`docs/PRODUCT_BOUNDARY.md`](./docs/PRODUCT_BOUNDARY.md).

## Model identity

| Source | Identity | Confidence |
|---|---|---|
| Ollama weights/manifest SHA-256 | Content-addressed SHA-256 | High |
| LM Studio/OpenAI-compatible API | Hashed provider/model identity | Medium |
| Filesystem model metadata | Hashed name, relative location, size, and modification time | Low |

A filesystem identity is not a content checksum. AI Footprints says so in every report
that includes filesystem-discovered models.

## Agent identity

Agent matching uses exact executable names, explicit `python -m` module
invocations, or explicit package-runner invocations such as `npx`. Product words
appearing in unrelated arguments or paths are rejected. Multiple processes with
the same product signature are aggregated into one agent product with an
`instance_count`; this is a process count, not a count of independent autonomous
agents or user sessions.

The checked-in curated conformance corpus covers all supported agent signatures
and difficult negative names on macOS, Linux, and Windows-style process
metadata. Run it with `npm run benchmark:agents`. Its result shows whether the
detector conforms to those labeled fixtures; it is not a representative sample
of real devices, so it must not be presented as field accuracy.

## Validation

```bash
npm ci
npm test
npm run benchmark:agents
npm run validate:macos
npm run smoke:package
npm run preflight:macos:release
```

The active GitHub Actions matrix covers Node 20, 22, and 24 on macOS, plus an
isolated installed-package smoke on macOS. `npm test` includes the conservative
agent conformance benchmark. See
[`benchmarks/README.md`](./benchmarks/README.md) for the benchmark method and
limitations.

`npm run validate:macos` performs two real-device scans, verifies stable item
sets, rejects non-loopback requests, checks the report privacy contract, and
fails if prohibited process/path keys appear. One machine is a release sanity
check, not a field-accuracy sample.

The multi-device protocol, local truth-file format, and quantitative public
release thresholds are defined in
[`docs/MACOS_ACCURACY_GATE.md`](./docs/MACOS_ACCURACY_GATE.md).

Storage, runtime-freshness, resource-attribution, and Developer ID truth
boundaries are defined in
[`docs/MACOS_MEASUREMENT_FOUNDATION.md`](./docs/MACOS_MEASUREMENT_FOUNDATION.md).

## Accuracy boundary

AI Footprints has no defensible global accuracy percentage yet. Runtime API evidence is
strongest; filesystem findings are explicitly best-effort; tool and MCP coverage
is limited to documented locations; and the agent benchmark is curated rather
than independently sampled. Do not market a benchmark pass as field precision
or recall. Global release requires a separately labelled, consented multi-device
macOS evaluation.

## Relationship to Forkit Connect

- Forkit AI Footprints: canonical read-only inventory core and report generation.
- Forkit Connect: supporting bridge for governed Model and Agent Passport flows.
- Forkit.dev website/registry: authoritative review and explicit final Mint.

AI Footprints is not a replacement production release for Connect. The intended
integration is for `forkit-connect census` to delegate to this package's public
core, avoiding two scanner implementations. Promotion requires an intentional
update to the Forkit.dev production lock.
