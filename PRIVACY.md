# Privacy Boundary

Forkit AI Footprints (`forkit-ai-footprints`) is metadata-only by design.

## Allowed local reads

- local operating-system and Node version metadata;
- the macOS Computer Name for display and storage only in the private local
  device journal;
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

## Prohibited collection or export

Census must not retain or emit:

- raw process commands;
- process IDs;
- model weights or file contents;
- full filesystem paths;
- prompts, responses, terminal logs, or source-code content;
- credentials, cookies, tokens, API keys, or passwords;
- hostname or Mac display name in Census reports, saved share pages, anonymous
  contributions, or global payloads; username, email, and Forkit.dev account
  identity are prohibited everywhere.
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

The interactive app keeps `device-journal.json` under the user's macOS
Application Support directory with directory mode `0700` and file mode `0600`.
It contains only the sanitized Mac display name, first/last scan timestamps, and
scan count. It is never placed in the Census report, rescan snapshot, share
image, saved share page, or anonymous/global contribution. The local runtime
stream is same-origin, session-token protected, aggregate-only, and sampled no
more often than every 500 ms; it makes no external request.

The packaged app uses a native launcher to query Apple DeviceCheck capability.
The status check makes no network request and writes no key. On a future
supported, signed macOS 27+ build, a separate explicit enrollment action may
generate one App Attest key and store only its opaque key identifier in the
device-only Keychain. The current UI and CLI do not invoke enrollment,
attestation, assertion generation, or upload.

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

## Model storage measurement

Storage is the exact logical byte total (`stat.size`) of recognized model files
inside the supported or explicitly selected roots when the scan reports
`storage_complete=true`. Device/inode identity prevents the same file from being
counted twice through hard links, symlinks, or overlapping roots. Provider API
size fields are excluded from the total to avoid double-counting the same model.
This is not APFS physical allocation: clones, compression, filesystem metadata,
and unsupported model locations can make actual disk blocks differ.

## Resource evidence

CPU and memory remain detected-process window measurements, not exclusive
per-prompt proof. Static hardware metadata can describe device capability but
not task utilization. GPU and network-traffic attribution are reported as
unavailable because the release does not have a supported cross-process source
that proves exclusive third-party task ownership. No estimate is substituted.

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
disabled by default. That candidate now fails closed without Apple App Attest
verification and excludes quarantined or revoked installations from the public
pulse. The CLI still contains no proof enrollment or upload transport. Enabling
either remains a founder/security release gate.

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

## Optional private evolution history

The interactive page does not save scan history automatically. After reveal,
the user may click `Save private baseline` or `Save this scan`. That action
writes at most 12 aggregate snapshots to browser local storage on the same Mac:
timestamp, model/loaded-model/runtime/agent counts, recognized model-file bytes,
and the derived chapter label. It excludes item names, paths, commands, the
guess, task-observation samples, and account identity. `Clear history` removes
that browser-local record. No history is sent to Forkit.
