# macOS Measurement Foundation

Status: local candidate only (`future/investigate`)

This document defines what Forkit AI Footprints may call a measurement. It is a
technical truth boundary, not marketing copy.

## Device-local continuity

The app detects the user-visible macOS Computer Name and keeps it with first
scan, last scan, and scan count in an owner-only local journal. The device name
is useful only for the person looking at their Mac. It is excluded from Census
reports, saved/shareable artifacts, and every anonymous/global schema.

## Model storage

`storage_bytes` means recognized logical file bytes, not an estimate and not a
1–10 GB band. The storage ledger:

- reads filesystem metadata, never model contents;
- counts a device/inode once across overlapping roots, symlinks, and hard links;
- excludes runtime API size fields from the byte total to prevent duplication;
- scans supported extensions in known or user-selected roots;
- exposes `storage_complete`; an incomplete scan must not be described as exact;
- does not claim APFS physical block allocation, clone sharing, or compression.

## Runtime freshness

The local page can consume a same-origin, token-protected NDJSON stream. It
refreshes no more frequently than every 500 ms and reports the actual scan
latency. A runtime transition becomes visible after provider response time plus
up to one sampling interval. This is bounded near-real-time, not zero delay.

Provider-native events can replace polling later where a documented local event
API exists. Polling remains necessary for providers that expose only snapshot
endpoints.

## Resource evidence levels

| Metric | Current evidence | Task exclusivity | Public wording |
|---|---|---:|---|
| CPU | OS samples for strongly detected processes over the user window | No | Detected-process CPU |
| Memory | OS samples for strongly detected processes over the user window | No | Detected-process memory |
| GPU | No supported cross-process proof source integrated | No | Unavailable |
| Hardware | Static OS hardware metadata | Not task usage | Device capability |
| Network traffic | No supported per-process proof source integrated | No | Unavailable |

Exclusive per-task proof requires control of the workload boundary. A future
Forkit-launched task runner could create a child-process tree, sample it from
before launch to after exit, and attribute deltas to that controlled tree. Even
then, shared daemon, runtime, unified-memory, and remote-provider work must be
shown separately rather than silently assigned to the task.

## Developer ID gate

Run `npm run preflight:macos:release`. It fails closed until the machine has:

1. full Xcode selected;
2. Developer ID Application and Developer ID Installer identities, including
   their private keys;
3. a working `notarytool` Keychain profile named through
   `FORKIT_MACOS_NOTARY_PROFILE`;
4. an explicit App Attest environment selection.

The build may be signed and notarized only after those checks pass. Release and
deployment remain separate founder approvals.
