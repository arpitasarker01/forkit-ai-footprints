#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { runCensus } from './census';
import { runDoctor } from './doctor';
import { formatCensusReport, formatDoctorReport } from './format';
import { PRODUCT_VERSION } from './version';
import { ActivityMonitor } from './monitor';
import { evaluateMacosFieldTruthFile } from './evaluate';
import { aggregateMacosFieldEvaluationDirectory } from './aggregate';
import { renderCensusSharePage } from './share-page';
import { startAiFootprintsServer } from './server';
import { recordLocalScan } from './local-device';

interface ParsedOptions {
  command: 'install' | 'help' | 'version' | 'scan' | 'monitor' | 'doctor' | 'evaluate' | 'aggregate' | 'share-page' | 'serve';
  json: boolean;
  output: string | null;
  includeRuntimes: boolean;
  includeFilesystem: boolean;
  includeAgents: boolean;
  includeTools: boolean;
  includeMcp: boolean;
  modelDirs: string[];
  verbose: boolean;
  copy: boolean;
  guess: number | null;
  anonymousPayload: boolean;
  shareConsent: boolean;
  truth: string | null;
  results: string | null;
  port: number;
}

const HELP = `Forkit AI Footprints
Private, metadata-only local AI inventory.
Apple Silicon macOS local release.

Usage:
  forkit-ai-footprints
  forkit-ai-footprints serve [--port 47811]
  forkit-ai-footprints monitor [--json]
  forkit-ai-footprints scan [options]
  forkit-ai-footprints doctor [--json]
  forkit-ai-footprints share-page --output /path/to/local-ai-footprint.html
  forkit-ai-footprints --version

Options:
  --json                 Print a machine-readable AI Footprint report
  --verbose              Show detector and identity details
  --guess <count>        Compare your estimate with discovered models
  --copy                 Copy the rendered local result to the clipboard
  --anonymous-payload    Reserved for a completed ten-minute monitor session
  --consent-share        Prepare an aggregate payload; native-app consent controls Preview sync
  --output <file>        Save the selected human or JSON report
  --model-dir <path>     Inspect an explicit model directory; repeatable
  --truth <file>         Evaluate locally against manually labelled macOS truth
  --results <directory>  Aggregate local macOS evaluation JSON files
  --port <number>        Local-only serve port (default: 47811)
  --no-runtimes          Skip local runtime API discovery
  --no-model-files       Skip filesystem model metadata discovery
  --no-agents            Skip local process metadata discovery
  --no-tools             Skip passive AI-tool detection
  --no-mcp               Skip known MCP configuration counts
  -h, --help             Show this help

Privacy:
  AI Footprints reads metadata only. It does not read model bytes or retain raw
  process commands or MCP configuration values. It does not write to any passport,
  registry, or Runtime_C2 service. The installed app may sync only the allowlisted anonymous
  Global AI Preview aggregate after explicit v3 consent and ten valid minutes.
`;

export function parseArgs(args: string[]): ParsedOptions {
  let command: ParsedOptions['command'] = 'install';
  let json = false;
  let output: string | null = null;
  let includeRuntimes = true;
  let includeFilesystem = true;
  let includeAgents = true;
  let includeTools = true;
  let includeMcp = true;
  let verbose = false;
  let copy = false;
  let guess: number | null = null;
  let anonymousPayload = false;
  let shareConsent = false;
  let truth: string | null = null;
  let results: string | null = null;
  let port = 47811;
  const modelDirs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === 'install' || arg === 'install-app') command = 'install';
    else if (arg === 'scan' || arg === 'report') command = 'scan';
    else if (arg === 'monitor') command = 'monitor';
    else if (arg === 'doctor') command = 'doctor';
    else if (arg === 'evaluate') command = 'evaluate';
    else if (arg === 'aggregate') command = 'aggregate';
    else if (arg === 'share-page') command = 'share-page';
    else if (arg === 'serve') command = 'serve';
    else if (arg === '--version' || arg === '-V' || arg === 'version') command = 'version';
    else if (arg === '--help' || arg === '-h' || arg === 'help') command = 'help';
    else if (arg === '--json') json = true;
    else if (arg === '--verbose') verbose = true;
    else if (arg === '--copy') copy = true;
    else if (arg === '--anonymous-payload') anonymousPayload = true;
    else if (arg === '--consent-share') shareConsent = true;
    else if (arg === '--no-runtimes') includeRuntimes = false;
    else if (arg === '--no-model-files') includeFilesystem = false;
    else if (arg === '--no-agents') includeAgents = false;
    else if (arg === '--no-tools') includeTools = false;
    else if (arg === '--no-mcp') includeMcp = false;
    else if (arg === '--guess') {
      const rawGuess = args[index + 1];
      const parsedGuess = Number(rawGuess);
      if (!rawGuess || !Number.isFinite(parsedGuess) || parsedGuess < 0) {
        throw new Error('--guess requires a non-negative number.');
      }
      guess = Math.floor(parsedGuess);
      index += 1;
    }
    else if (arg === '--port') {
      const rawPort = args[index + 1];
      const parsedPort = Number(rawPort);
      if (!rawPort || !Number.isSafeInteger(parsedPort) || parsedPort < 1024 || parsedPort > 65535) {
        throw new Error('--port requires an integer from 1024 to 65535.');
      }
      port = parsedPort;
      index += 1;
    }
    else if (arg === '--output') {
      output = args[index + 1] ?? null;
      if (!output) throw new Error('--output requires a file path.');
      index += 1;
    } else if (arg === '--truth') {
      truth = args[index + 1] ?? null;
      if (!truth) throw new Error('--truth requires a file path.');
      index += 1;
    } else if (arg === '--results') {
      results = args[index + 1] ?? null;
      if (!results) throw new Error('--results requires a directory path.');
      index += 1;
    } else if (arg === '--model-dir') {
      const directory = args[index + 1];
      if (!directory) throw new Error('--model-dir requires a directory path.');
      modelDirs.push(directory);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return {
    command,
    json,
    output,
    includeRuntimes,
    includeFilesystem,
    includeAgents,
    includeTools,
    includeMcp,
    modelDirs,
    verbose,
    copy,
    guess,
    anonymousPayload,
    shareConsent,
    truth,
    results,
    port,
  };
}

const FORKIT_APP_NAME = 'Forkit AI Footprint.app';
const FORKIT_BUNDLE_IDENTIFIER = 'dev.forkit.ai-footprints';
const LAUNCH_SERVICES = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';

async function isForkitApp(appPath: string): Promise<boolean> {
  const info = await fs.readFile(path.join(appPath, 'Contents', 'Info.plist'), 'utf8').catch(() => '');
  return info.includes(FORKIT_BUNDLE_IDENTIFIER);
}

async function recognizedForkitApps(applicationsDirectory: string): Promise<string[]> {
  const entries = await fs.readdir(applicationsDirectory, { withFileTypes: true }).catch(() => []);
  const apps: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.endsWith('.app') || entry.name.startsWith('.')) continue;
    const candidate = path.join(applicationsDirectory, entry.name);
    if (await isForkitApp(candidate)) apps.push(candidate);
  }
  return apps;
}

function stopRunningForkitApps(appPaths: string[]): void {
  const snapshot = spawnSync('/bin/ps', ['-axo', 'pid=,ppid=,comm='], { encoding: 'utf8', shell: false });
  if (snapshot.status !== 0 || !snapshot.stdout) return;
  const processes = snapshot.stdout.split('\n').map((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
    return match ? { pid: Number(match[1]), parent: Number(match[2]), command: match[3]! } : null;
  }).filter((entry): entry is { pid: number; parent: number; command: string } => Boolean(entry));
  const matching = processes.filter((entry) => appPaths.some((appPath) => entry.command.startsWith(`${appPath}/Contents/`)));
  if (matching.length === 0) return;
  const matchingPids = new Set(matching.map((entry) => entry.pid));
  const ordered = [...matching].sort((left, right) => Number(matchingPids.has(right.parent)) - Number(matchingPids.has(left.parent)));
  for (const entry of ordered) {
    try { process.kill(entry.pid, 'SIGTERM'); } catch { /* process already ended */ }
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 800);
  for (const entry of ordered) {
    try { process.kill(entry.pid, 0); process.kill(entry.pid, 'SIGKILL'); } catch { /* process ended cleanly */ }
  }
}

function unregisterApp(appPath: string): void {
  spawnSync(LAUNCH_SERVICES, ['-u', appPath], { stdio: 'ignore', shell: false });
}

function registerApp(appPath: string): void {
  spawnSync(LAUNCH_SERVICES, ['-f', appPath], { stdio: 'ignore', shell: false });
}

export async function installPersistentMacApp(options: { applicationsDirectory?: string; open?: boolean } = {}): Promise<string> {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('The persistent GUI currently supports Apple Silicon macOS only.');
  const source = path.join(__dirname, 'bootstrap', `${FORKIT_APP_NAME}.zip`);
  try { await fs.access(source); }
  catch { throw new Error('This package does not contain the macOS GUI bootstrap. Install from the packed release candidate.'); }
  const applicationsDirectory = options.applicationsDirectory
    ?? process.env.FORKIT_AI_FOOTPRINTS_APPLICATIONS_DIR
    ?? path.join(os.homedir(), 'Applications');
  const destination = path.join(applicationsDirectory, FORKIT_APP_NAME);
  const staging = path.join(applicationsDirectory, `.Forkit AI Footprint.installing-${process.pid}.app`);
  const previous = path.join(applicationsDirectory, `.Forkit AI Footprint.previous-${process.pid}.app`);
  const extraction = path.join(applicationsDirectory, `.Forkit AI Footprint.extracting-${process.pid}`);
  const shouldOpen = options.open !== false && process.env.FORKIT_AI_FOOTPRINTS_NO_OPEN !== '1';
  await fs.mkdir(applicationsDirectory, { recursive: true, mode: 0o700 });
  const recognizedApps = await recognizedForkitApps(applicationsDirectory);
  stopRunningForkitApps(recognizedApps);
  await fs.rm(staging, { recursive: true, force: true });
  await fs.rm(extraction, { recursive: true, force: true });
  await fs.mkdir(extraction, { recursive: true, mode: 0o700 });
  const unpacked = spawnSync('/usr/bin/ditto', ['-x', '-k', source, extraction], { stdio: 'ignore', shell: false });
  const extractedApp = path.join(extraction, FORKIT_APP_NAME);
  if (unpacked.status !== 0 || !(await isForkitApp(extractedApp))) {
    await fs.rm(extraction, { recursive: true, force: true });
    throw new Error('The packaged macOS app has an unexpected identity.');
  }
  await fs.rename(extractedApp, staging);
  await fs.rm(extraction, { recursive: true, force: true });
  let hadPrevious = false;
  try {
    const existingInfo = await fs.readFile(path.join(destination, 'Contents', 'Info.plist'), 'utf8').catch(() => '');
    if (existingInfo && !existingInfo.includes(FORKIT_BUNDLE_IDENTIFIER)) throw new Error('The destination contains a different application.');
    if (existingInfo) { unregisterApp(destination); await fs.rename(destination, previous); hadPrevious = true; }
    await fs.rename(staging, destination);
    if (hadPrevious) await fs.rm(previous, { recursive: true, force: true });
    for (const duplicate of recognizedApps) {
      if (duplicate === destination) continue;
      unregisterApp(duplicate);
      await fs.rm(duplicate, { recursive: true, force: true });
    }
    if (shouldOpen) registerApp(destination);
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true });
    await fs.rm(extraction, { recursive: true, force: true });
    if (hadPrevious) await fs.rename(previous, destination).catch(() => undefined);
    throw error;
  }
  if (shouldOpen) {
    const launched = spawnSync('/usr/bin/open', [destination], { stdio: 'ignore', shell: false });
    if (launched.status !== 0) throw new Error('Forkit was installed, but macOS could not open it.');
  }
  return destination;
}

async function emit(output: string, filePath: string | null): Promise<void> {
  process.stdout.write(output);
  if (filePath) await fs.writeFile(filePath, output, { encoding: 'utf8', flag: 'w' });
}

export function clipboardCommands(platform: NodeJS.Platform): Array<{ command: string; args: string[] }> {
  if (platform === 'darwin') return [{ command: 'pbcopy', args: [] }];
  if (platform === 'win32') return [{ command: 'clip', args: [] }];
  return [
    { command: 'wl-copy', args: [] },
    { command: 'xclip', args: ['-selection', 'clipboard'] },
  ];
}

function copyToClipboard(value: string): boolean {
  for (const invocation of clipboardCommands(process.platform)) {
    const result = spawnSync(invocation.command, invocation.args, {
      input: value,
      encoding: 'utf8',
      stdio: ['pipe', 'ignore', 'ignore'],
      shell: false,
    });
    if (result.status === 0) return true;
  }
  return false;
}

export async function main(args = process.argv.slice(2)): Promise<number> {
  let options: ParsedOptions;
  try {
    options = parseArgs(args);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Invalid arguments'}\n\n${HELP}`);
    return 2;
  }

  if (options.command === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  if (options.command === 'version') {
    process.stdout.write(`${PRODUCT_VERSION}\n`);
    return 0;
  }
  if (options.command === 'install') {
    const destination = await installPersistentMacApp();
    process.stdout.write(`Forkit AI Footprint is installed at ${destination}\nOpen it later from Applications or Spotlight; Terminal is no longer required.\nOn first launch, Forkit asks whether an aggregate-only measurement may be contributed to the Global AI Preview after ten valid observed minutes. Nothing is sent unless the person explicitly agrees.\n`);
    return 0;
  }
  if (options.command === 'serve') {
    const service = await startAiFootprintsServer({ port: options.port });
    process.stdout.write(`Forkit AI Footprints is ready at ${service.url}\nMetadata stays on this device. Press Ctrl+C to stop.\n`);
    if (process.platform === 'darwin' && process.env.FORKIT_AI_FOOTPRINTS_NO_OPEN !== '1'
      && process.env.FORKIT_AI_FOOTPRINTS_APP_BUNDLE !== '1') {
      spawnSync('open', [service.url], { stdio: 'ignore', shell: false });
    }
    await new Promise<void>((resolve) => {
      const stop = () => { void service.close().finally(resolve); };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
    return 0;
  }
  if (options.command === 'monitor') {
    const monitor = new ActivityMonitor();
    await monitor.start();
    process.stderr.write('Monitoring locally until Ctrl+C. Process IDs and commands are not emitted.\n');
    await new Promise<void>((resolve) => {
      const stop = () => resolve();
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
    const summary = monitor.stop();
    const rendered = options.json
      ? `${JSON.stringify(summary, null, 2)}\n`
      : `Observed ${summary.observed_seconds.toFixed(1)}s · AI active ${summary.active_seconds.toFixed(1)}s · ratio ${summary.activity_ratio === null ? 'unavailable' : `${Math.round(summary.activity_ratio * 100)}%`}\n`;
    await emit(rendered, options.output);
    if (options.anonymousPayload) {
      process.stderr.write('Anonymous preview requires a completed ten-minute GUI session with the exact payload reviewed first. Nothing was uploaded.\n');
      return 2;
    }
    return 0;
  }
  if (options.command === 'doctor') {
    const report = await runDoctor();
    const rendered = options.json
      ? `${JSON.stringify(report, null, 2)}\n`
      : formatDoctorReport(report);
    await emit(rendered, options.output);
    return report.ok ? 0 : 1;
  }
  if (options.command === 'evaluate') {
    if (!options.truth) {
      process.stderr.write('evaluate requires --truth with a local labelled macOS truth file.\n');
      return 2;
    }
    const evaluation = await evaluateMacosFieldTruthFile(options.truth);
    await emit(`${JSON.stringify(evaluation, null, 2)}\n`, options.output);
    return 0;
  }
  if (options.command === 'aggregate') {
    if (!options.results) {
      process.stderr.write('aggregate requires --results with a directory of local evaluation JSON files.\n');
      return 2;
    }
    const aggregate = await aggregateMacosFieldEvaluationDirectory(options.results);
    await emit(`${JSON.stringify(aggregate, null, 2)}\n`, options.output);
    return 0;
  }
  if (options.command === 'share-page') {
    if (!options.output) {
      process.stderr.write('share-page requires --output with a local HTML file path.\n');
      return 2;
    }
    const report = await runCensus({
      includeRuntimes: options.includeRuntimes,
      includeFilesystem: options.includeFilesystem,
      includeAgents: options.includeAgents,
      includeTools: options.includeTools,
      includeMcp: options.includeMcp,
      guess: options.guess,
      ...(options.modelDirs.length > 0 ? { filesystemRoots: options.modelDirs } : {}),
    });
    if (process.env.FORKIT_AI_FOOTPRINTS_DISABLE_JOURNAL !== '1') {
      await recordLocalScan({ now: () => new Date(report.generated_at) });
      report.privacy.local_state_written = true;
      report.privacy.local_state_scope = 'device-journal-only';
    }
    await fs.writeFile(options.output, renderCensusSharePage(report), { encoding: 'utf8', flag: 'w' });
    process.stdout.write('Local aggregate share page written. No data was uploaded.\n');
    return 0;
  }

  const report = await runCensus({
    includeRuntimes: options.includeRuntimes,
    includeFilesystem: options.includeFilesystem,
    includeAgents: options.includeAgents,
    includeTools: options.includeTools,
    includeMcp: options.includeMcp,
    guess: options.guess,
    ...(options.modelDirs.length > 0 ? { filesystemRoots: options.modelDirs } : {}),
  });
  if (process.env.FORKIT_AI_FOOTPRINTS_DISABLE_JOURNAL !== '1') {
    await recordLocalScan({ now: () => new Date(report.generated_at) });
    report.privacy.local_state_written = true;
    report.privacy.local_state_scope = 'device-journal-only';
  }
  const rendered = options.json
    ? `${JSON.stringify(report, null, 2)}\n`
    : formatCensusReport(report, { verbose: options.verbose });
  await emit(rendered, options.output);
  if (options.copy && !copyToClipboard(rendered)) {
    process.stderr.write('Clipboard command unavailable; the result remains printable and can be copied from the terminal.\n');
  }
  if (options.anonymousPayload) {
    process.stderr.write(options.shareConsent
      ? 'Anonymous contribution was not prepared: a valid ten-minute monitor session and exact payload review are required. Nothing was uploaded.\n'
      : 'Anonymous contribution was not prepared: separate --consent-share is required. Nothing was uploaded.\n');
    return 2;
  }
  return 0;
}

if (require.main === module) {
  void main().then((code) => {
    process.exitCode = code;
  }).catch(() => {
    process.stderr.write('Forkit AI Footprints failed safely. No raw error details were printed.\n');
    process.exitCode = 1;
  });
}
