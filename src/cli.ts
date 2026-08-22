#!/usr/bin/env node
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { runCensus } from './census';
import { runDoctor } from './doctor';
import { formatCensusReport, formatDoctorReport } from './format';
import { PRODUCT_VERSION } from './version';
import { buildAnonymousCensusContribution } from './sharing';
import { evaluateMacosFieldTruthFile } from './evaluate';
import { aggregateMacosFieldEvaluationDirectory } from './aggregate';
import { renderCensusSharePage } from './share-page';
import { startAiFootprintsServer } from './server';

interface ParsedOptions {
  command: 'help' | 'version' | 'scan' | 'doctor' | 'evaluate' | 'aggregate' | 'share-page' | 'serve';
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
macOS-only experimental release candidate.

Usage:
  forkit-ai-footprints serve [--port 47811]
  forkit-ai-footprints scan [options]
  forkit-ai-footprints doctor [--json]
  forkit-ai-footprints share-page --output /path/to/local-ai-footprint.html
  forkit-ai-footprints --version

Options:
  --json                 Print a machine-readable AI Footprint report
  --verbose              Show detector and identity details
  --guess <count>        Compare your estimate with discovered models
  --copy                 Copy the rendered local result to the clipboard
  --anonymous-payload    Build an aggregate-only preview; never uploads
  --consent-share        Required with --anonymous-payload (separate consent)
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
  AI Footprints reads metadata only. It does not read model bytes, retain raw process
  commands or MCP configuration values, authenticate to Forkit.dev, or write to
  any passport, registry, Runtime_C2, or production service.
`;

export function parseArgs(args: string[]): ParsedOptions {
  let command: ParsedOptions['command'] = 'scan';
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
    if (arg === 'scan' || arg === 'report') command = 'scan';
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
  if (options.command === 'serve') {
    const service = await startAiFootprintsServer({ port: options.port });
    process.stdout.write(`Forkit AI Footprints is ready at ${service.url}\nMetadata stays on this device. Press Ctrl+C to stop.\n`);
    if (process.platform === 'darwin' && process.env.FORKIT_AI_FOOTPRINTS_NO_OPEN !== '1') {
      spawnSync('open', [service.url], { stdio: 'ignore', shell: false });
    }
    await new Promise<void>((resolve) => {
      const stop = () => service.server.close(() => resolve());
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
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
  let rendered: string;
  if (options.anonymousPayload && options.shareConsent) {
    const contribution = buildAnonymousCensusContribution(report, true);
    rendered = options.json
      ? `${JSON.stringify({ local_report: report, anonymous_contribution: contribution, uploaded: false }, null, 2)}\n`
      : `${formatCensusReport(report, { verbose: options.verbose })}\nAnonymous aggregate preview (not uploaded)\n${JSON.stringify(contribution, null, 2)}\n`;
  } else {
    rendered = options.json
      ? `${JSON.stringify(report, null, 2)}\n`
      : formatCensusReport(report, { verbose: options.verbose });
  }
  await emit(rendered, options.output);
  if (options.copy && !copyToClipboard(rendered)) {
    process.stderr.write('Clipboard command unavailable; the result remains printable and can be copied from the terminal.\n');
  }
  if (options.anonymousPayload && !options.shareConsent) {
    process.stderr.write('Anonymous contribution was not prepared: separate --consent-share is required. The local result above is complete.\n');
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
