import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function requireMatch(condition, message) {
  if (!condition) throw new Error(`RELEASE_COHERENCE_FAILED: ${message}`);
}

function resolveVersion(value, version) {
  if (typeof value === 'string') return value.replaceAll('{version}', version);
  if (Array.isArray(value)) return value.map((entry) => resolveVersion(entry, version));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveVersion(entry, version)]));
  }
  return value;
}

const packageMetadata = readJson('package.json');
const packageLock = readJson('package-lock.json');
const channelPlan = readJson('release/channels.json');
const version = packageMetadata.version;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

requireMatch(versionPattern.test(version), `package.json version is not valid SemVer: ${version}`);
requireMatch(packageLock.version === version, 'package-lock.json top-level version differs from package.json');
requireMatch(packageLock.packages?.['']?.version === version, 'package-lock.json root-package version differs from package.json');
requireMatch(channelPlan.version_source === 'package.json', 'release channel plan must derive its version from package.json');
requireMatch(channelPlan.product === packageMetadata.name, 'release channel product differs from npm package name');

const versionSource = fs.readFileSync(path.join(root, 'src/version.ts'), 'utf8');
const installerSource = fs.readFileSync(path.join(root, 'scripts/build-macos-installer.mjs'), 'utf8');
const status = fs.readFileSync(path.join(root, 'STATUS.md'), 'utf8');
requireMatch(versionSource.includes("from '../package.json'"), 'CLI version must be imported from package.json');
requireMatch(installerSource.includes('const productVersion = packageMetadata.version'), 'macOS installer must derive its version from package.json');
requireMatch(installerSource.includes('Forkit-AI-Footprints-${productVersion}'), 'macOS package filename must derive from productVersion');
requireMatch(status.includes(`Version: \`${version}\``), 'STATUS.md version differs from package.json');

const resolvedChannels = resolveVersion(channelPlan.channels, version);
const publicReleaseAvailable = resolvedChannels.github_release?.status === 'available'
  && resolvedChannels.npm?.status === 'available';
const manifest = {
  schema_version: channelPlan.schema_version,
  generated_at: new Date().toISOString(),
  product: channelPlan.product,
  version,
  version_source: channelPlan.version_source,
  repository: channelPlan.repository,
  release_tag: `v${version}`,
  availability: publicReleaseAvailable ? 'available' : 'prelaunch',
  promotion_required: !publicReleaseAvailable,
  support: channelPlan.support,
  channels: resolvedChannels,
};

if (process.argv.includes('--write')) {
  const outputDirectory = path.join(root, 'artifacts', 'release');
  const outputPath = path.join(outputDirectory, `forkit-ai-footprints-${version}-release.json`);
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${outputPath}\n`);
} else {
  process.stdout.write(`${JSON.stringify({
    coherent: true,
    product: manifest.product,
    version: manifest.version,
    release_tag: manifest.release_tag,
    channels: Object.fromEntries(Object.entries(manifest.channels).map(([name, channel]) => [name, {
      status: channel.status,
      ...(channel.install ? { install: channel.install } : {}),
      ...(channel.asset ? { asset: channel.asset } : {}),
    }])),
  }, null, 2)}\n`);
}
