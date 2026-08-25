# Forkit AI Footprints public GitHub handoff

Status: local release candidate for `forkit-ai-footprints@0.2.1`.

## Product identity

- Package: `forkit-ai-footprints`
- Intended public repository: `arpitasarker01/forkit-ai-footprints`
- Legacy local folder names are not product identity.

Public source, npm metadata, docs, and CLI commands must use
`forkit-ai-footprints` only.

## Current blocker

The intended GitHub repository must exist before public developer handoff. Until
then, package metadata points at a future repository URL and developers cannot
clone or open issues from that URL.

Required before public handoff:

1. Create or rename the GitHub repository to
   `arpitasarker01/forkit-ai-footprints`.
2. Update the local `origin` remote to that repository.
3. Push only a clean, reviewed release branch.
4. Create the `v0.2.1` release from the same commit that passed tests.
5. Attach the npm tarball, release manifest, checksum, SBOM, and validation
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

Public GitHub does not mean public data upload. AI Footprints may prepare a local
aggregate after consent, but production global intake remains closed until the
verified contribution gate is approved. The public repository should keep this
boundary visible in README, privacy docs, and release notes.
