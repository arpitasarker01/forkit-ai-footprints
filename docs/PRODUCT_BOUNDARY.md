# Product Boundary

Sector: CLI discovery and local inventory

Status: `future/investigate`

Forkit Census is an experimental metadata-only inventory CLI derived from
Forkit Connect discovery work.

## Allowed MVP

- discover supported local runtime APIs;
- inventory model metadata;
- classify and deduplicate known local agent products;
- produce human and JSON reports;
- diagnose local Census readiness;
- package and test on macOS, Ubuntu, and Windows.

## Explicitly excluded

- Forkit.dev authentication;
- passport draft creation or final Mint;
- registry writes;
- Runtime_C2 mutation or heartbeat;
- billing, plans, workspaces, or account state;
- telemetry upload;
- remote endpoint inspection;
- native desktop/mobile packaging;
- npm publication or production deployment.

## Promotion gate

Census remains `future/investigate` until founders intentionally update
`docs/PRODUCTION_LOCK.md` in `arpitasarker01/forkit_dev_base`.

The standalone repository cannot promote itself. A future promotion must define
its relationship to Forkit Connect, website copy, privacy/legal review, package
ownership, support expectations, and release gates.
