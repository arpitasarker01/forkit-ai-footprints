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

## Commands

```bash
forkit-census scan
forkit-census scan --json
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
```

## What Census reports

- availability of supported loopback runtime APIs;
- model names and provider identities;
- Ollama content digests when exposed by the runtime;
- metadata-only fingerprints for supported local model files;
- known AI agent products with process-instance counts;
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

Detection remains a suggestion. No accuracy percentage should be claimed until
a labeled cross-platform benchmark exists.

## Validation

```bash
npm ci
npm test
npm run smoke:package
```

The GitHub Actions matrix covers Node 20, 22, and 24 on Ubuntu, macOS, and
Windows. Isolated package smokes run on all three operating systems.

## Relationship to Forkit Connect

- Forkit Census: read-only inventory and report generation.
- Forkit Connect: supporting bridge for governed Model and Agent Passport flows.
- Forkit.dev website/registry: authoritative review and explicit final Mint.

Census is not a replacement production release for Connect. Promotion requires
an intentional update to the Forkit.dev production lock.
