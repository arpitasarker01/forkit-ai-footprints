# Contributing

Forkit Census accepts focused changes to metadata-only local discovery,
cross-platform reliability, report readability, and detector accuracy.

## Setup

```bash
npm ci
npm test
npm run smoke:package
```

Node 22 is recommended for development. Node 20, 22, and 24 are supported.

## Pull requests

- Keep one behavior or detector family per pull request.
- Add positive, negative, deduplication, and privacy tests for detector changes.
- Preserve one unified `scan` across runtimes, models, and agents.
- Never expose raw process commands, absolute paths, or file contents.
- Do not add auth, Mint, registry-write, Runtime_C2-write, or telemetry paths.
- Do not bump the version or publish npm without founder authorization.
- Update `STATUS.md` when verified behavior or a known limitation changes.

## Accuracy claims

Rule confidence is not measured accuracy. Do not publish an accuracy percentage
until a labeled cross-platform corpus and precision/recall report are checked into
the repository.
