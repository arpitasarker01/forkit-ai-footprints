# Forkit AI Footprints public GitHub handoff

Status: public open-source release for `forkit-ai-footprints@0.2.4`.

## Product identity

- Package: `forkit-ai-footprints`
- Intended public repository: `arpitasarker01/forkit-ai-footprints`
- Legacy local folder names are not product identity.

Public source, npm metadata, docs, and CLI commands must use
`forkit-ai-footprints` only.

## Current release state

The public GitHub repository, protected `main` branch, `v0.2.4` tag, and npm
package resolve. CI, CodeQL, secret scanning, push protection, Dependabot,
private vulnerability reporting, issue templates, contribution guidance,
CODEOWNERS, and the security policy protect the public collaboration path.

Required for every later release:

1. Push only a clean, reviewed release branch after founder approval.
2. Create the versioned release from the same commit that passed tests.
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
