# Forkit AI Footprints

Forkit AI Footprints is a private, metadata-only view of the models, runtimes,
and AI agents present on a Mac. The prepared package and command are
`forkit-ai-footprints`; `forkit-census` remains a temporary binary alias.

It is derived from the discovery lessons in Forkit Connect, but it has a
different safety boundary: AI Footprints does not authenticate to Forkit.dev and has
no passport, Mint, registry-write, Runtime_C2-write, or production deployment
path.

Product status: `future/investigate`

Current support target: **macOS only**. The real-device validation so far is on
Apple Silicon. Ubuntu, Windows, Android, and Intel Mac are not part of the
current release claim.

## Install on macOS — developer preview

Requirements:

- macOS;
- Node.js 20, 22, or 24
- npm

```bash
git clone https://github.com/arpitasarker01/forkit-census.git
cd forkit-census
npm ci
npm pack
npm install -g ./forkit-ai-footprints-0.1.0.tgz
forkit-ai-footprints serve
```

The package is not published to npm. Do not treat the command below as available
from the public registry until a founder authorizes publication:

```bash
npm install -g forkit-ai-footprints
forkit-ai-footprints serve
```

The two commands above follow the same install-first pattern as Forkit Connect.
They become a public registry install only after an authorized npm release.
The intended zero-install alternative is:

```bash
npx -y forkit-ai-footprints@latest serve
```

## Commands

Run a local scan, verify the installation, or score one manually labelled Mac:

```bash
forkit-ai-footprints serve
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
Census ID. Its copy/share controls include only the visible aggregate summary
and run only after a user click.

The compact Global AI Pulse stays empty until a caller supplies a validated,
consented aggregate. The local page never fetches or invents global totals.

`serve` binds only to `127.0.0.1`, keeps the report in memory, and opens the
Guess → Actual experience. `Scan again` calls a random-token-protected local
endpoint and returns aggregate display fields only. The guess remains in the
browser page and is never sent to the local server or Forkit.dev.

After revealing the result, `Create share card` renders a 1200×630 PNG entirely
in the browser. The card turns Guess → Discovered into a visual story and uses
only four aggregate fields: model records, active runtimes, active agents, and
the model-storage bucket. It can be downloaded or passed to the operating
system share sheet after an explicit click; no model names or scan records are
placed in the image or uploaded by AI Footprints.

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

`--anonymous-payload --consent-share` creates an aggregate-only preview after
the local result. It does not upload anything. The preview excludes model,
tool, MCP server, workspace, repository, machine, and account identifiers.

## Shared core API

Forkit Connect should delegate to the package's public, read-only core rather
than copy its detector implementation:

```js
const { runCensus } = require('forkit-ai-footprints');

const report = await runCensus();
```

The package root also exports the individual metadata detectors, formatters,
provider adapters, endpoint validation, anonymous-preview builder, and TypeScript
types. A fresh-install smoke test imports the package root and verifies that an
all-disabled core scan makes zero external requests and writes no local state.

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
- a best-effort model-storage bucket and optional guess comparison;
- confidence labels and review warnings;
- platform, architecture, and Node major version.

## What AI Footprints does not collect

- model weights or file contents;
- prompts or responses;
- raw process commands;
- full model paths in reports;
- credentials, tokens, API keys, or passwords;
- hostname, username, email address, or account identity.

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
