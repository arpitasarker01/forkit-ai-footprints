import process from 'node:process';
import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'pipe', shell: false });
  return { ok: result.status === 0, output: `${result.stdout || ''}${result.stderr || ''}`.trim() };
}

const developerDirectory = run('xcode-select', ['-p']);
const xcode = run('xcodebuild', ['-version']);
const codeSigning = run('security', ['find-identity', '-v', '-p', 'codesigning']);
const installerCertificates = run('security', ['find-certificate', '-a', '-c', 'Developer ID Installer']);
const applicationIdentity = /Developer ID Application:/.test(codeSigning.output);
const installerIdentity = /Developer ID Installer:/.test(installerCertificates.output);
const notaryProfile = String(process.env.FORKIT_MACOS_NOTARY_PROFILE || '');
const notaryCredentials = notaryProfile
  ? run('xcrun', ['notarytool', 'history', '--keychain-profile', notaryProfile]).ok
  : false;
const checks = {
  macos: process.platform === 'darwin',
  apple_silicon: process.arch === 'arm64',
  full_xcode: xcode.ok && !developerDirectory.output.includes('CommandLineTools'),
  developer_id_application_identity: applicationIdentity,
  developer_id_installer_identity: installerIdentity,
  notary_keychain_profile: notaryCredentials,
  app_attest_environment_selected: ['development', 'production'].includes(String(process.env.FORKIT_MACOS_APP_ATTEST_ENVIRONMENT || '')),
};
const ready = Object.values(checks).every(Boolean);
process.stdout.write(`${JSON.stringify({
  validation: 'macos-developer-id-release-preflight',
  ready,
  checks,
  safe_next_action: ready
    ? 'Build the signed installer, submit it with notarytool, staple, verify with spctl, then test on a separate clean Mac.'
    : 'Install full Xcode and the Developer ID Application/Installer certificates, store a notarytool keychain profile, and select the App Attest environment.',
}, null, 2)}\n`);
process.exitCode = ready ? 0 : 1;
