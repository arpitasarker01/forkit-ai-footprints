import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const finalDirectory = path.join(root, 'dist', 'bootstrap');
const finalArchive = path.join(finalDirectory, 'Forkit AI Footprint.app.zip');
const target = path.join(os.tmpdir(), `forkit-ai-footprint-bootstrap-${process.pid}`, 'Forkit AI Footprint.app');
const contents = path.join(target, 'Contents');
const macos = path.join(contents, 'MacOS');
const resources = path.join(contents, 'Resources');
const appResources = path.join(resources, 'app');
const runtime = path.join(resources, 'runtime');
const executable = path.join(macos, 'Forkit AI Footprint');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
}

if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('The npm GUI bootstrap currently supports Apple Silicon macOS only.');
fs.rmSync(path.dirname(target), { recursive: true, force: true });
fs.rmSync(finalDirectory, { recursive: true, force: true });
fs.mkdirSync(macos, { recursive: true });
fs.mkdirSync(appResources, { recursive: true });
fs.mkdirSync(runtime, { recursive: true });
fs.cpSync(path.join(root, 'dist'), path.join(appResources, 'dist'), { recursive: true, filter: (source) => path.basename(source) !== 'bootstrap' });
fs.mkdirSync(path.join(appResources, 'node_modules'), { recursive: true });
fs.cpSync(path.join(root, 'node_modules', 'ps-list'), path.join(appResources, 'node_modules', 'ps-list'), { recursive: true });
fs.copyFileSync(process.execPath, path.join(runtime, 'node'));
fs.chmodSync(path.join(runtime, 'node'), 0o755);
fs.copyFileSync(path.join(root, 'dist', 'assets', 'forkit-icon-light.png'), path.join(resources, 'ForkitStatusTemplate.png'));

const iconset = path.join(os.tmpdir(), `forkit-footprints-icon-${process.pid}.iconset`);
fs.rmSync(iconset, { recursive: true, force: true });
fs.mkdirSync(iconset);
const sourceIcon = path.join(root, 'dist', 'assets', 'forkit-icon-light.png');
for (const [name, size] of [['icon_16x16.png',16],['icon_16x16@2x.png',32],['icon_32x32.png',32],['icon_32x32@2x.png',64],['icon_128x128.png',128],['icon_128x128@2x.png',256],['icon_256x256.png',256],['icon_256x256@2x.png',512],['icon_512x512.png',512],['icon_512x512@2x.png',1024]]) run('sips', ['-z', String(size), String(size), sourceIcon, '--out', path.join(iconset, name)]);
run('iconutil', ['-c', 'icns', iconset, '-o', path.join(resources, 'ForkitAIFootprint.icns')]);
fs.rmSync(iconset, { recursive: true, force: true });

fs.writeFileSync(path.join(appResources, 'package.json'), `${JSON.stringify({ name: 'forkit-ai-footprints-bundled', version: metadata.version, private: true, type: 'commonjs' }, null, 2)}\n`);
fs.writeFileSync(path.join(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleDevelopmentRegion</key><string>en</string><key>CFBundleDisplayName</key><string>Forkit AI Footprint</string><key>CFBundleExecutable</key><string>Forkit AI Footprint</string><key>CFBundleIconFile</key><string>ForkitAIFootprint</string><key>CFBundleIdentifier</key><string>dev.forkit.ai-footprints</string><key>CFBundleInfoDictionaryVersion</key><string>6.0</string><key>CFBundleName</key><string>Forkit AI Footprint</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleShortVersionString</key><string>${metadata.version}</string><key>CFBundleVersion</key><string>1</string><key>LSMinimumSystemVersion</key><string>14.0</string>
</dict></plist>\n`);
run('xcrun', ['swiftc', '-parse-as-library', path.join(root, 'native/macos/ForkitAiFootprintsLauncher.swift'), '-framework', 'AppKit', '-framework', 'WebKit', '-framework', 'DeviceCheck', '-framework', 'CryptoKit', '-framework', 'Security', '-o', executable]);
fs.chmodSync(executable, 0o755);
run('xattr', ['-cr', target]);
run('codesign', ['--force', '--timestamp=none', '--sign', '-', path.join(runtime, 'node')]);
run('codesign', ['--force', '--deep', '--timestamp=none', '--sign', '-', target]);
run('codesign', ['--verify', '--deep', '--strict', target]);
fs.mkdirSync(finalDirectory, { recursive: true });
fs.writeFileSync(path.join(finalDirectory, '.metadata_never_index'), '');
run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', target, finalArchive]);
fs.rmSync(path.dirname(target), { recursive: true, force: true });
process.stdout.write(`${finalArchive}\n`);
