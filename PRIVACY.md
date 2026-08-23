# Privacy Boundary

Forkit AI Footprints (`forkit-ai-footprints`) is metadata-only by design.

## Allowed local reads

- local operating-system and Node version metadata;
- process name and command metadata held only long enough to classify explicit
  executable, module, or package-runner evidence; raw commands are not included
  in the report or in the evidence hash;
- process CPU and memory percentages aggregated only for strongly classified
  agent processes as a point-in-time local snapshot;
- directory entries and file metadata for supported model extensions;
- loopback runtime API responses from explicitly supported local endpoints.
- known AI-tool installation/configuration path existence;
- macOS major version, CPU architecture, and Node major in aggregate field-test
  results;
- aggregate counts, exact recognized model-file bytes, architecture, Node major, product version,
  and scan date in an explicitly saved local HTML share page;
- up to 1 MiB from a known MCP JSON/TOML configuration file solely to count
  server entries.

## Prohibited collection

Census must not retain or emit:

- raw process commands;
- process IDs;
- model weights or file contents;
- full filesystem paths;
- prompts, responses, terminal logs, or source-code content;
- credentials, cookies, tokens, API keys, or passwords;
- hostname, username, email, or Forkit.dev account identity.
- MCP server names, commands, URLs, environment keys, environment values,
  workspace names, or repository names.

## Network boundary

Census may call HTTP(S) endpoints only when the hostname is one of:

- `localhost`
- `127.0.0.1`
- `::1`

Remote endpoints and endpoints containing embedded credentials are rejected.
Census contains no Forkit.dev login, registry-write, passport-publish,
Runtime_C2-write, billing, telemetry-upload, or deployment client.

`forkit-ai-footprints serve` binds only to `127.0.0.1`. Its rescan route
requires the same page origin and a random in-memory session token. The route
returns aggregate display fields only; it never returns item names, paths,
commands, endpoints, configuration values, or account data. The numeric guess
is compared inside the browser and is not submitted to the local server.
`Close local scan` uses the same origin and random in-memory token, then stops
the loopback server.

`Observe one AI task` starts and stops only after user clicks. During that
window, AI Footprints keeps aggregate CPU/memory samples for strongly detected
agent processes in memory. The result includes duration, sample count, average
and peak CPU/memory percentages, and maximum agent/loaded-model counts. It does
not retain process IDs or commands. Shared processes may include background
activity, so this is not a per-prompt, energy, token, cost, or GPU measurement.

## Filesystem identity

Filesystem model identity is derived from metadata such as relative location,
name, size, and modification time. The absolute path participates only inside a
local one-way root fingerprint helper and is not included in a Census Report.
Model bytes are never read for hashing.

## Review rule

Runtime, model, and agent findings are inventory suggestions. They must not be
used as automatic evidence of ownership, safety, provenance, or passport status.

## Anonymous contribution boundary

The CLI can create a local, allowlisted aggregate preview only after
separate explicit consent. It contains OS/architecture, aggregate counts,
confirmed-running count, active agent product/process counts, exact recognized
model-file bytes, detector types, and version numbers. It excludes the guess and the
local Census ID and all item-level records. The CLI still has no uploader. A
separate Forkit.dev aggregate endpoint candidate exists with contribution writes
disabled by default; enabling it remains a founder/security release gate.

## Local share page

`forkit-ai-footprints share-page --output ...` saves a self-contained HTML result only
after the user supplies an output path. The page contains aggregate counts and
limitations, not item names, paths, commands, endpoints, configuration values,
account identity, or the local Census ID. It loads no external assets and makes
no automatic network requests. Its copy/share controls act only after a user
click and use aggregate text.

The interactive `serve` page can also render a 1200×630 discovery card locally
with browser Canvas. It includes the user's browser-only numeric guess plus
aggregate model-record, loaded-state, agent-process, recognized storage, and
point-in-time agent CPU/memory values, or the user-timed observation result when
the user has explicitly completed one.
The image has no item names, paths, account identifiers, or external assets.
Downloading it or opening the operating system share sheet requires a separate
user click; AI Footprints does not receive the image.
