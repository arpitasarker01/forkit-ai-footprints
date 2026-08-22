# Forkit Census

Forkit Census is a metadata-only CLI for creating a reviewable inventory of
local AI runtimes, models, and agent products.

It is derived from the discovery lessons in Forkit Connect, but it has a
different safety boundary: Census does not authenticate to Forkit.dev and has
no passport, Mint, registry-write, Runtime_C2-write, or production deployment
path.

Product status: `future/investigate`

## Install for development

Requirements:

- Node.js 20, 22, or 24
- npm

```bash
git clone https://github.com/arpitasarker01/forkit-census.git
cd forkit-census
npm ci
npm test
```

The package is not published to npm. Do not treat the command below as available
from the public registry until a founder authorizes publication:

```bash
npm install -g ./forkit-census-0.1.0.tgz
```

After an authorized npm release, the intended zero-install entry point is:

```bash
npx -y forkit-census@latest
```

## Commands

```bash
forkit-census
forkit-census scan
forkit-census scan --json
forkit-census scan --verbose --guess 5
forkit-census scan --copy
forkit-census report --json --output census.json
forkit-census scan --model-dir /path/you/selected
forkit-census doctor
forkit-census --version
```

One `scan` includes runtime APIs, filesystem model metadata, and agent process
metadata by default. Individual surfaces can be disabled:

```bash
forkit-census scan --no-runtimes
forkit-census scan --no-model-files
forkit-census scan --no-agents
forkit-census scan --no-tools
forkit-census scan --no-mcp
```

`--anonymous-payload --consent-share` creates an aggregate-only preview after
the local result. It does not upload anything. The preview excludes model,
tool, MCP server, workspace, repository, machine, and account identifiers.

## Shared core API

Forkit Connect should delegate to the package's public, read-only core rather
than copy its detector implementation:

```js
const { runCensus } = require('forkit-census');

const report = await runCensus();
```

The package root also exports the individual metadata detectors, formatters,
provider adapters, endpoint validation, anonymous-preview builder, and TypeScript
types. A fresh-install smoke test imports the package root and verifies that an
all-disabled core scan makes zero external requests and writes no local state.

## What Census reports

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

## What Census does not collect

- model weights or file contents;
- prompts or responses;
- raw process commands;
- full model paths in reports;
- credentials, tokens, API keys, or passwords;
- hostname, username, email address, or account identity.

Census only connects to loopback HTTP(S) endpoints. Remote hosts and URLs with
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

A filesystem identity is not a content checksum. Census says so in every report
that includes filesystem-discovered models.

## Agent identity

Agent matching uses exact executable names or exact command tokens. It does not
use arbitrary substring matching. Multiple processes with the same product
signature are aggregated into one agent product with an `instance_count`.

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
npm run smoke:package
```

The GitHub Actions matrix covers Node 20, 22, and 24 on Ubuntu, macOS, and
Windows. `npm test` includes the agent conformance benchmark, and isolated
package smokes run on all three operating systems. See
[`benchmarks/README.md`](./benchmarks/README.md) for the benchmark method and
limitations.

## Relationship to Forkit Connect

- Forkit Census: canonical read-only inventory core and report generation.
- Forkit Connect: supporting bridge for governed Model and Agent Passport flows.
- Forkit.dev website/registry: authoritative review and explicit final Mint.

Census is not a replacement production release for Connect. The intended
integration is for `forkit-connect census` to delegate to this package's public
core, avoiding two scanner implementations. Promotion requires an intentional
update to the Forkit.dev production lock.
