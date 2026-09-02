# Release Process

Forkit AI Footprints uses immutable SemVer releases. Every public channel must
refer to the same reviewed source commit and package version.

## Release authority

Maintainers review and approve releases. Pull requests from forks cannot publish
packages, create production credentials, or broaden the product and privacy
boundary.

## Required gates

Before creating a release tag:

```bash
npm ci
npm test
npm run validate:macos
npm run smoke:package
npm run preflight:macos:release
npm run release:check
```

The release commit must be clean, reviewed, and pushed to the protected default
branch. `package.json`, `package-lock.json`, `STATUS.md`, the release tag, npm,
and the release-channel manifest must use the same version.

## Publication sequence

1. Update the version and changelog in a focused release pull request.
2. Run the complete release gate on supported hardware.
3. Merge the reviewed commit and create the matching `v<version>` tag.
4. Publish the exact tagged package through npm Trusted Publishing when that
   publisher is available.
5. Verify the public npm version, integrity, and install path.
6. Create the GitHub release and attach the release manifest, checksum, SBOM,
   and relevant validation evidence.
7. Update the Forkit.dev release manifest only after every advertised channel
   resolves to the approved version.

Normal commits and pull requests must not publish npm packages. Long-lived npm
tokens are not part of the release design.

## Channel policy

- npm is the current installation channel.
- GitHub Releases provide immutable source and release evidence.
- Homebrew remains unavailable until a maintained tap exists.
- A direct installer remains unavailable until Developer ID signing,
  notarization, stapling, Gatekeeper verification, and clean-device testing pass.

If channel versions or checksums disagree, installation promotion stops until
coherence is restored. Published npm versions are immutable and are never
overwritten.

## Security and privacy review

Changes to detectors, process inspection, filesystem reads, local persistence,
network destinations, consent, signing, aggregate fields, or packaging require
maintainer and privacy review. A release must not expand the collection or
network boundary implicitly.

Security fixes follow coordinated disclosure through the private process in
[SECURITY.md](../SECURITY.md).
