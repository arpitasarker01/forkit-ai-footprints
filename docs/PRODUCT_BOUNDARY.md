# Product Boundary

Sector: CLI discovery and local inventory

Status: `future/investigate`

Forkit AI Footprints is the public name for the experimental metadata-only
inventory CLI. Its technical package remains `forkit-census` so developer
interfaces do not break.

## Allowed MVP

- discover supported local runtime APIs;
- inventory model metadata;
- classify and deduplicate known local agent products;
- produce human and JSON reports;
- generate an explicitly saved, self-contained aggregate-only local HTML share
  page with no automatic network requests;
- diagnose local Census readiness;
- prepare a consent-gated, aggregate-only anonymous contribution preview without
  transmitting it;
- package and test an experimental macOS-only release candidate.

Ubuntu, Windows, Android, and other operating systems are outside the current
support claim until separately validated and promoted.

## Explicitly excluded

- Forkit.dev authentication;
- passport draft creation or final Mint;
- registry writes;
- Runtime_C2 mutation or heartbeat;
- billing, plans, workspaces, or account state;
- telemetry or Global Census upload;
- remote endpoint inspection;
- native desktop/mobile packaging;
- npm publication or production deployment.

## Promotion gate

Census remains `future/investigate` until founders intentionally update
`docs/PRODUCTION_LOCK.md` in `arpitasarker01/forkit_dev_base`.

The standalone repository cannot promote itself. A future promotion must define
its relationship to Forkit Connect, website copy, privacy/legal review, package
ownership, support expectations, and release gates.
