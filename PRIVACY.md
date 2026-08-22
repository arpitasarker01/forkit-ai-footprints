# Privacy Boundary

Forkit AI Footprints (`forkit-ai-footprints`) is metadata-only by design.

## Allowed local reads

- local operating-system and Node version metadata;
- process name and command metadata held only long enough to classify explicit
  executable, module, or package-runner evidence; raw commands are not included
  in the report or in the evidence hash;
- directory entries and file metadata for supported model extensions;
- loopback runtime API responses from explicitly supported local endpoints.
- known AI-tool installation/configuration path existence;
- macOS major version, CPU architecture, and Node major in aggregate field-test
  results;
- aggregate counts, storage bucket, architecture, Node major, product version,
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

## Filesystem identity

Filesystem model identity is derived from metadata such as relative location,
name, size, and modification time. The absolute path participates only inside a
local one-way root fingerprint helper and is not included in a Census Report.
Model bytes are never read for hashing.

## Review rule

Runtime, model, and agent findings are inventory suggestions. They must not be
used as automatic evidence of ownership, safety, provenance, or passport status.

## Anonymous contribution boundary

The current build can create a local, allowlisted aggregate preview only after
separate explicit consent. It contains OS/architecture, aggregate counts,
confirmed-running count, storage bucket, optional numeric guess, detector types,
and version numbers. It excludes the local Census ID and all item-level records.
No upload transport or Global AI Footprints backend is present while the product stays
`future/investigate`.

## Local share page

`forkit-ai-footprints share-page --output ...` saves a self-contained HTML result only
after the user supplies an output path. The page contains aggregate counts and
limitations, not item names, paths, commands, endpoints, configuration values,
account identity, or the local Census ID. It loads no external assets and makes
no automatic network requests. Its copy/share controls act only after a user
click and use aggregate text.
