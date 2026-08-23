# Forkit AI Footprints global distribution

Status: local release design only. Nothing described here is published or
production-approved.

## Goal

Offer a free, professional installation path to Mac users anywhere in the
world, while ensuring npm, Homebrew, GitHub Releases, the future Mac installer,
and the website can never silently recommend different product versions.

## One release identity

`package.json` is the only version source. The CLI imports it at build time and
the native Mac package builder reads it directly. `npm run release:check`
rejects a different lockfile version, CLI version source, native package version,
or documented status version.

`npm run release:manifest` generates the candidate release manifest under
`artifacts/release/`. The generated manifest is metadata only; generating it
does not publish anything.

## Global channels

| Channel | Audience | Cost to users | Current state |
|---|---|---:|---|
| GitHub Release | canonical immutable artifacts and checksums | Free | Not published |
| Homebrew tap | recommended global macOS installation | Free | Tap not created |
| npm public registry | developers who already have Node/npm | Free | Package not published |
| Signed `.pkg` | future click installation | Free to users | Blocked on paid Apple identity and notarization |

Homebrew and npm are not tied to the founder's Mac. They are global registries;
the current product support claim is still macOS on Apple Silicon until broader
field validation exists.

## Release order

1. Bump `package.json` and `package-lock.json` together.
2. Run tests, package smoke, real-Mac validation, and `npm run release:check`.
3. Build the npm tarball and candidate release manifest on a clean hosted runner.
4. Create one draft GitHub Release for `v<version>` and attach the tarball,
   manifest, checksum, SBOM, and provenance evidence.
5. After founder approval, publish the exact tested package to npm through npm
   trusted publishing (GitHub Actions OIDC), not a long-lived npm token.
6. Update the Homebrew tap from the immutable release URL and SHA-256.
7. Mark a channel `available` in the release manifest only after its registry
   resolves to the same version and checksum.
8. Let Forkit.dev read the verified manifest and recommend the simplest
   available channel. If coherence fails, the website must show no install CTA.

The release automation should run only for an approved release tag or a manual
release action—not for normal commits—so it does not waste GitHub Actions runs.

## Hugging Face cache boundary

AI Footprints supports the official Hub file cache at
`~/.cache/huggingface/hub`, `$HF_HOME/hub`, `$HF_HUB_CACHE`, and the
XDG-configured equivalent. It recognizes `models--<org>--<repo>` directories
and follows snapshot links while deduplicating the same physical blob across
revisions.

`HF_XET_CACHE` is deliberately excluded. It contains transport chunks that can
be shared across files and would double-count model storage. Datasets, Spaces,
assets, incomplete downloads, and unreferenced extensionless blobs are also not
reported as model storage. The reported value is therefore exact for recognized
model artifacts inside supported roots, not the total size of every Hugging
Face cache directory.

## Brand assets

The website's `/brand/icon-dark.svg` and `/brand/icon-light.svg` are byte-for-byte
copies of the supplied `Logo_Forkit/logo_Only/color_Dark/color_Dark.svg` and
`Logo_Forkit/logo_Only/color_Light/color_Light.svg`. The dark-outline mark is for
light surfaces; the light-outline mark is for dark surfaces. The product name
remains live text so the older “Forkit Dev” wordmark is not incorrectly presented
as the AI Footprints product name.
