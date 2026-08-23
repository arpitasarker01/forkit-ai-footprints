import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const outputRoot = path.join(root, 'artifacts', 'macos');
const cacheRoot = path.join(root, 'artifacts', 'runtime-cache');
const stagingRoot = path.join(outputRoot, 'pkg-root');
const appName = 'Forkit AI Footprints.app';
const appPath = path.join(stagingRoot, 'Applications', appName);
const contents = path.join(appPath, 'Contents');
const macosDir = path.join(contents, 'MacOS');
const resources = path.join(contents, 'Resources');
const appResources = path.join(resources, 'app');
const runtimeDir = path.join(resources, 'runtime');
const executablePath = path.join(macosDir, 'Forkit AI Footprints');
const bundledNode = path.join(runtimeDir, 'node');
const packagePath = path.join(outputRoot, `Forkit-AI-Footprints-0.2.0-macos-${process.arch}.pkg`);
const nodeEntitlementsPath = path.join(outputRoot, 'node-entitlements.plist');
const appEntitlementsPath = path.join(outputRoot, 'app-entitlements.plist');
const applicationIdentity = process.env.FORKIT_MACOS_APPLICATION_IDENTITY || '-';
const installerIdentity = process.env.FORKIT_MACOS_INSTALLER_IDENTITY || '';
const appAttestEnvironment = process.env.FORKIT_MACOS_APP_ATTEST_ENVIRONMENT || '';
const nodeVersion = '24.10.0';
const nodeArchiveName = `node-v${nodeVersion}-darwin-arm64.tar.gz`;
const nodeArchive = path.join(cacheRoot, nodeArchiveName);
const nodeArchiveSha256 = 'fbc3d6e1e1d962450d058e918214373872cc4c46e08673f31c35932afac4a8c5';

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

if (process.platform !== 'darwin') throw new Error('The macOS installer must be built on macOS.');
if (process.arch !== 'arm64') throw new Error('The current release candidate supports Apple Silicon only.');
if (!fs.existsSync(path.join(root, 'dist', 'cli.js'))) throw new Error('Run npm run build before building the installer.');
if (appAttestEnvironment && !['development', 'production'].includes(appAttestEnvironment)) throw new Error('Invalid App Attest environment.');
if (appAttestEnvironment && applicationIdentity === '-') throw new Error('App Attest entitlement requires a real Apple signing identity.');

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(cacheRoot, { recursive: true });
fs.mkdirSync(macosDir, { recursive: true });
fs.mkdirSync(appResources, { recursive: true });
fs.mkdirSync(runtimeDir, { recursive: true });

fs.cpSync(path.join(root, 'dist'), path.join(appResources, 'dist'), { recursive: true });
fs.mkdirSync(path.join(appResources, 'node_modules'), { recursive: true });
fs.cpSync(path.join(root, 'node_modules', 'ps-list'), path.join(appResources, 'node_modules', 'ps-list'), { recursive: true });
if (!fs.existsSync(nodeArchive)) {
  run('curl', ['--fail', '--location', '--silent', '--show-error', '--output', nodeArchive, `https://nodejs.org/dist/v${nodeVersion}/${nodeArchiveName}`]);
}
const actualArchiveHash = run('shasum', ['-a', '256', nodeArchive]).split(/\s+/)[0];
if (actualArchiveHash !== nodeArchiveSha256) throw new Error('Official Node runtime checksum mismatch.');
const runtimeExtract = path.join(outputRoot, 'runtime-extract');
fs.mkdirSync(runtimeExtract, { recursive: true });
run('tar', ['-xzf', nodeArchive, '-C', runtimeExtract]);
fs.copyFileSync(path.join(runtimeExtract, `node-v${nodeVersion}-darwin-arm64`, 'bin', 'node'), bundledNode);
fs.chmodSync(bundledNode, 0o755);

fs.writeFileSync(path.join(appResources, 'package.json'), `${JSON.stringify({ private: true, type: 'commonjs' }, null, 2)}\n`);
fs.writeFileSync(path.join(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleDisplayName</key><string>Forkit AI Footprints</string>
  <key>CFBundleExecutable</key><string>Forkit AI Footprints</string>
  <key>CFBundleIdentifier</key><string>dev.forkit.ai-footprints</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>Forkit AI Footprints</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.2.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>LSUIElement</key><true/>
</dict></plist>
`);
fs.writeFileSync(nodeEntitlementsPath, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
</dict></plist>
`);
const appAttestEntitlement = appAttestEnvironment
  ? `  <key>com.apple.developer.devicecheck.appattest-environment</key><string>${appAttestEnvironment}</string>\n`
  : '';
fs.writeFileSync(appEntitlementsPath, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
${appAttestEntitlement}</dict></plist>
`);
run('xcrun', ['swiftc', '-parse-as-library', path.join(root, 'native/macos/ForkitAiFootprintsLauncher.swift'), '-framework', 'DeviceCheck', '-framework', 'CryptoKit', '-framework', 'Security', '-o', executablePath]);
fs.chmodSync(executablePath, 0o755);
run('xattr', ['-cr', appPath]);

const timestampArgs = applicationIdentity === '-' ? ['--timestamp=none'] : ['--timestamp'];
run('codesign', ['--force', '--options', 'runtime', ...timestampArgs, '--entitlements', nodeEntitlementsPath, '--sign', applicationIdentity, bundledNode]);
run('codesign', ['--force', '--options', 'runtime', ...timestampArgs, '--entitlements', appEntitlementsPath, '--sign', applicationIdentity, appPath]);
run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath]);

const pkgArgs = ['--root', stagingRoot, '--identifier', 'dev.forkit.ai-footprints.pkg', '--version', '0.2.0', '--install-location', '/'];
if (installerIdentity) pkgArgs.push('--sign', installerIdentity);
pkgArgs.push(packagePath);
run('pkgbuild', pkgArgs);

const smoke = run(bundledNode, [path.join(appResources, 'dist', 'cli.js'), '--version']);
if (smoke !== '0.2.0') throw new Error(`Bundled CLI smoke returned ${smoke}.`);
const appAttestCapability = JSON.parse(run(executablePath, ['--app-attest', 'status']));
if (appAttestCapability.network_request_made !== false) throw new Error('App Attest capability smoke made an unexpected network request.');

const releaseReady = applicationIdentity !== '-' && Boolean(installerIdentity);
process.stdout.write(`${JSON.stringify({
  appPath,
  packagePath,
  architecture: process.arch,
  bundledRuntime: `v${nodeVersion}`,
  appAttestCapability,
  releaseReady,
  nextReleaseGate: releaseReady
    ? 'Submit the pkg with xcrun notarytool, staple it, verify with spctl, then test on a separate clean Mac.'
    : 'Local unsigned candidate only. Developer ID Application and Installer identities are required before distribution.',
}, null, 2)}\n`);
