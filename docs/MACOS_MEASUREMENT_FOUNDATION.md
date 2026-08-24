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

## Activity freshness and states

The local service samples the macOS process tree at a one-second target interval
and streams snapshots to a same-origin token-protected page. **Active now**
requires two consecutive samples with a cumulative CPU-time delta of at least
20 ms and at least 2% of the valid interval. Three negative samples return a
present process tree to **Ready**. An absent supported process remains outside
active activity. Gaps longer than three sample intervals are excluded from observed
and active duration.

This is bounded near-real-time, not zero delay. A transition normally appears
after two to three valid samples plus provider-response time. Supported local
runtime processes enter activity classification only while a verified provider
reports a loaded model; provider-native events may replace polling later.

## Resource evidence levels

| Metric | Current evidence | Task exclusivity | Public wording |
|---|---|---:|---|
| CPU | Repeated cumulative CPU-time deltas and current OS CPU for supported process trees | No | Supported AI activity / current process-tree CPU |
| Memory | Current OS resident memory for supported process trees | No | Current process-tree memory context |
| GPU | No supported cross-process proof source integrated | No | Unavailable |
| Hardware | Static OS hardware metadata | Not task usage | Device capability |
| Network traffic | No supported per-process proof source integrated | No | Unavailable |

Exclusive per-task proof requires control of the workload boundary. A future
Forkit-launched task runner could create a child-process tree, sample it from
before launch to after exit, and attribute deltas to that controlled tree. Even
then, shared daemon, runtime, unified-memory, and remote-provider work must be
shown separately rather than silently assigned to the task.

Forkit's own process tree is excluded from supported AI activity. Its current,
median, and p95 CPU, current/maximum resident memory, and bounded serialized
history bytes are shown separately as scanner overhead. These are operating-
system process measurements, not energy or billing estimates.

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
