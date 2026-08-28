# Privacy Boundary

Forkit AI Footprints (`forkit-ai-footprints`) is metadata-only by design.

## Allowed local reads

- local operating-system and Node version metadata;
- the macOS Computer Name for display and storage only in the private local
  device journal;
- process name and command metadata held only long enough to classify explicit
  executable, module, or package-runner evidence; raw commands are not included
  in the report or in the evidence hash;
- cumulative CPU time, current CPU percentage, and resident memory for supported
  process trees, held locally for repeated activity classification and bounded
  aggregate per-app resource-history buckets; raw process entries are never
  exported;
- the macOS console-lock flag and aggregate HID idle duration, used only to
  pause observation while the device is locked or has not recently been used;
  no keys, pointer movements, or input content are recorded;
- directory entries and file metadata for supported model extensions;
- loopback runtime API responses from explicitly supported local endpoints.
- known AI-tool installation/configuration path existence;
- local runtime, model, AI-app, and AI-tool display names in the interactive
  loopback UI; an explicitly created local share image may include only the
  supported active tool product name, while model names and all item names are
  excluded from saved HTML and anonymous/global payloads;
- optional chat/workspace labels supplied explicitly by a cooperating app for
  local display only; for Codex, the most recent local catalog display title,
  recency, and project path may be read, with only the project folder basename
  retained in memory;
- macOS major version, CPU architecture, and Node major in aggregate field-test
  results;
- aggregate counts, exact recognized model-file bytes, architecture, Node major, product version,
  and scan date in an explicitly saved local HTML share page;
- up to 1 MiB from a known MCP JSON/TOML configuration file solely to count
  server entries.

## Prohibited collection or export

AI Footprints must not retain or emit:

- raw process commands;
- process IDs;
- model weights or file contents;
- full filesystem paths;
- prompts, responses, terminal logs, or source-code content;
- credentials, cookies, tokens, API keys, or passwords;
- hostname or Mac display name in AI Footprints reports, saved share pages, anonymous
  contributions, or global payloads; username, email, and Forkit.dev account
  identity are prohibited everywhere.
- MCP server names, commands, URLs, environment keys, or environment values;
- chat, workspace, or repository names in reports, saved/shareable artifacts,
  contribution previews, or global payloads.

## Network boundary

AI Footprints may call HTTP(S) endpoints only when the hostname is one of:

- `localhost`
- `127.0.0.1`
- `::1`
- `www.forkit.dev`, limited to `/api/v1/ai-footprints/challenges` and
  `/api/v1/ai-footprints/contributions` after explicit Preview consent and the
  one-hour eligibility gate.

Other remote endpoints and endpoints containing embedded credentials are rejected.
AI Footprints contains no Forkit.dev login, registry-write, passport-publish,
Runtime_C2-write, billing, general telemetry, or deployment client.

`forkit-ai-footprints serve` binds only to `127.0.0.1`. Its rescan route
requires the same page origin and a random in-memory session token. The route
may return local runtime, model, AI-app, and AI-tool display names to that
protected local page. It never returns full paths, raw commands, endpoints,
configuration values, prompts, or account data. A supported app's recent local
workflow title and project folder basename may appear only in this protected
local page and are never written to a report or share/global artifact.
The numeric guess is compared inside the browser and is not submitted to the
local server. Start, Stop, Clear history, Scan again, and contribution preview
all require the same-origin random session token. Closing a browser or native
window does not stop monitoring; native Quit stops the monitor and local service.

The interactive app keeps `device-journal.json` under the user's macOS
Application Support directory with directory mode `0700` and file mode `0600`.
It contains only the sanitized Mac display name, first/last scan timestamps, and
scan count. It is never placed in the AI Footprints report, rescan snapshot, share
image, saved share page, or anonymous/global contribution. The local monitor
stream is same-origin and session-token protected. Sampling runs at a one-second
target interval; durations exclude stopped time and gaps longer than three
intervals. Observation also pauses while macOS is locked or after 60 seconds
without user input, and resumes with a new continuous activity block. The lock
and idle signals remain local and are excluded from reports, share artifacts,
and global aggregates. The stream makes no external request.

The packaged app uses a native launcher to query Apple DeviceCheck capability.
The status check makes no network request and writes no key. On a future
supported, signed macOS 27+ build, a separate explicit enrollment action may
generate one App Attest key and store only its opaque key identifier in the
device-only Keychain. The current UI and CLI do not invoke enrollment,
attestation, assertion generation, or upload.

On first launch of the v2 Preview consent, the native app states that an
anonymous aggregate will be sent after one valid observed hour and refreshed
when internet is available. The answer and consent version are stored locally
in macOS user defaults. A user who chose “Not now” can reopen the same
permission from the comparison view. No request is made before permission.

## Filesystem identity

Filesystem model identity is derived from metadata such as relative location,
name, size, and modification time. The absolute path participates only inside a
local one-way root fingerprint helper and is not included in an AI Footprints report.
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

**Working now** requires sustained cumulative CPU-time deltas across repeated
samples of a supported process tree. Two positive samples enter working and
three negative samples exit it. Process presence alone remains **Open / idle**.
This is still not exclusive per-prompt proof. Supported AI-app CPU/RAM history
is retained only as bounded local aggregate buckets by app signature/name,
observed time, active time, average/peak CPU, average/peak memory, peak process
count, and sample count. It excludes raw process rows, process IDs, commands,
paths, prompts, responses, and account identity, and it is not included in the
anonymous/global payload. Forkit's own process tree is excluded from AI activity
and measured separately for CPU, RAM, and bounded history overhead. Static
hardware metadata describes capability, not use. GPU and per-process network
attribution remain unavailable; no estimate is used.

## Review rule

Runtime, model, and agent findings are inventory suggestions. They must not be
used as automatic evidence of ownership, safety, provenance, or passport status.

## Anonymous contribution boundary

The local app can create and send an allowlisted schema `2.0` Preview only after
at least 3,600 valid observed seconds and explicit v2 native permission. The Preview
contains valid seconds, AI-active seconds, activity ratio, supported app count
and categories, model/loaded/runtime counts, recognized model-file bytes,
macOS major, architecture, and scanner/runtime schema versions. It excludes
names, process counts, CPU/RAM values, guess, device identity, local scan ID,
timestamps, and all item-level records. The native app generates one owner-only
local Ed25519 key, signs the exact aggregate against a one-time server challenge,
and stores a small local sync receipt. The server persists only a keyed hash of
the public contribution identity and one latest aggregate. Community Preview
signatures prevent undetected payload changes and simple replay; they do not
prove unique hardware or truthful measurement. Public Preview copy must say
community-reported and not hardware-verified. Apple App Attest verification and
verified ranking remain a separate founder/security release gate.

## Local share page

`forkit-ai-footprints share-page --output ...` saves a self-contained HTML result only
after the user supplies an output path. The page contains aggregate counts and
limitations, not item names, paths, commands, endpoints, configuration values,
account identity, or the local scan ID. It loads no external assets and makes
no automatic network requests. Its copy/share controls act only after a user
click and use aggregate text.

The interactive `serve` page can also render a 1080×1080 discovery card locally
with browser Canvas. It includes model-record count, recognized storage,
activity ratio, and the supported active tool product name. Its result line is
derived only from measured local insights. The image has no model names, paths,
process counts, device/account identifiers, workspace/chat titles, or external
assets.
Downloading it or opening the operating system share sheet requires a separate
user click; AI Footprints does not receive the image.
Inside the native macOS app, Save PNG, Copy Image, Copy Caption, and Share use a
loopback-page-to-AppKit bridge restricted to the current local service port. The
bridge accepts only a validated 1080×1080 PNG and a bounded aggregate caption.
