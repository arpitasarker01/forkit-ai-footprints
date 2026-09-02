# Forkit AI Footprints Status

Last updated: 2026-09-02

Version: `0.2.6`

Release state: public npm release and community-reported Global AI Preview.

Supported platform: Apple Silicon macOS.

## Available now

- A persistent local app installed through
  `npx --yes forkit-ai-footprints@latest`.
- Start, stop, pause, reconnect, and quit behavior owned by the local service
  rather than the browser window.
- A responsive activity timeline with working, ready, paused, and excluded
  intervals.
- Per-app selection and focus controls, exact interval inspection, observation
  totals, and deterministic local insights.
- Current CPU and memory evidence plus bounded local aggregate per-app resource
  summaries. Forkit's own overhead is measured separately.
- Supported local runtime discovery, recognized model inventory, logical model
  storage, and provider-confirmed loaded state.
- Local English and German interfaces and a private 1080×1080 share image.
- An optional schema `2.0` community contribution after explicit v3 consent and
  ten valid observed minutes, refreshed no more than once per hour.

## Privacy and trust state

- Local monitoring, history, app colors, and summaries remain on the device.
- No prompts, responses, raw commands, full paths, credentials, account
  identity, or local device name enter share or community payloads.
- Community contributions are allowlisted, challenge-bound, and signed with a
  stable local Ed25519 key.
- Signatures establish payload integrity and contribution continuity. They do
  not establish unique hardware or independently verified measurement.
- The public aggregate is labelled **Preview** and **community-reported**.
  Hardware-verified ranking is not available.

## Measurement limits

- **AI-active** means sustained recent CPU-time change in a supported AI-app
  process tree. It is not prompt, task, token, or model ownership.
- GPU, energy, cost, token count, disk I/O, per-process network traffic, and
  per-app storage attribution are not measured.
- Local model storage covers recognized logical files inside supported roots,
  not whole-disk usage or physical APFS allocation.
- The curated detector corpus is conformance evidence, not a representative
  field-accuracy result.
- Intel Mac, Windows, Linux, Android, Homebrew, and a signed direct installer
  are not supported release channels.

## Release verification

The release gate covers the TypeScript build, complete test suite, detector
conformance corpus, isolated package smoke, macOS privacy/network validation,
native launcher checks, and release-channel coherence.

Reproducible commands and the latest real-device evidence are recorded in
[docs/VALIDATION.md](./docs/VALIDATION.md). The full collection and measurement
rules are defined in [PRIVACY.md](./PRIVACY.md) and
[docs/PRODUCT_BOUNDARY.md](./docs/PRODUCT_BOUNDARY.md).

## Next release gates

- Representative multi-device field validation before any field-accuracy
  percentage is published.
- Apple Developer ID signing, notarization, stapling, Gatekeeper verification,
  and clean-device testing before a direct installer is offered.
- Separate hardware verification and abuse controls before verified global
  ranking is enabled.
