# Forkit AI Footprints public GitHub handoff

Status: approved public release for `forkit-ai-footprints@0.2.3`.

## Product identity

- Package: `forkit-ai-footprints`
- Intended public repository: `arpitasarker01/forkit-ai-footprints`
- Legacy local folder names are not product identity.

Public source, npm metadata, docs, and CLI commands must use
`forkit-ai-footprints` only.

## Current release gate

The intended GitHub repository resolves. The reviewed clean commit, release
tag, package artifact, and npm version must all refer to the same source.

Required before public handoff:

1. Push only a clean, reviewed release branch after founder approval.
2. Create the `v0.2.3` release from the same commit that passed tests.
3. Attach the npm tarball, release manifest, checksum, SBOM, and validation
   evidence.

## Release channel coherence

Every channel must point to the same product version:

- `package.json`
- npm published version
- GitHub release tag
- Forkit website release manifest
- future Homebrew formula
- future signed macOS installer

If any channel differs, the website should not recommend installation until the
coherence check passes.

## Global sync boundary

Public GitHub does not mean automatic data upload. Community Preview intake is
open only after explicit v2 consent and one valid observed hour, and accepts
only the documented allowlisted aggregate. Apple-verified ranking remains a
separate future gate. The public repository keeps this boundary visible in
README, privacy docs, and release notes.
