# Contributing

Forkit AI Footprints welcomes focused, reviewable contributions to metadata-only
local discovery, macOS reliability, accessibility, localization, report
readability, detector accuracy, tests, and documentation.

The standalone client is open source so its measurement and privacy boundaries
can be inspected and improved in public. Forkit.dev accounts, backend services,
production infrastructure, and private operational data are not part of this
repository.

## Ways to contribute

- Use a bug report for reproducible behavior that differs from the documented
  product boundary.
- Use a feature proposal before building a large change or adding a new
  detector family.
- Open a focused pull request for a small fix, test, localization improvement,
  accessibility improvement, or documentation correction.
- Report security or privacy vulnerabilities privately through GitHub Security
  Advisories. Do not place sensitive device evidence in a public issue.

## Setup

```bash
npm ci
npm test
npm run smoke:package
```

Node 22 is recommended for development. Node 20, 22, and 24 are supported.

## Pull requests

- Fork the repository, create a topic branch, and open a pull request into
  `main`. Maintainers review and merge accepted changes.
- Keep one behavior or detector family per pull request.
- Explain what changed, why it is safe, and how it was validated.
- Add positive, negative, deduplication, and privacy tests for detector changes.
- Preserve one unified `scan` across runtimes, models, and agents.
- Never expose raw process commands, absolute paths, or file contents.
- Do not add auth, Mint, registry-write, Runtime_C2-write, or telemetry paths.
- Do not weaken consent, loopback-only networking, local file permissions, or
  the anonymous Global AI Preview allowlist.
- Do not bump the version or publish npm without founder authorization.
- Update `STATUS.md` when verified behavior or a known limitation changes.

Every pull request runs the macOS/Node test matrix and package smoke. Sensitive
surfaces are owned by the maintainers in `CODEOWNERS`; passing automation does
not replace maintainer review.

## Scope and review

Small fixes can go directly to a pull request. Start with a feature proposal for
new operating-system support, a new network destination, a new data field, a
new persistence surface, or a new distribution channel. Those changes require
an explicit product-boundary and privacy review before implementation.

Pull requests may be declined when they broaden collection, cannot be validated
truthfully, duplicate existing architecture, or fall outside the current
Apple Silicon macOS release scope.

By contributing, you agree that your contribution is licensed under this
repository's MIT License and that you have the right to submit it.

## Accuracy claims

Rule confidence is not measured accuracy. Do not publish an accuracy percentage
until a labeled cross-platform corpus and precision/recall report are checked into
the repository.
