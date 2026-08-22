#!/usr/bin/env node
import fs from 'node:fs/promises';
import { runCensus } from './census';
import { runDoctor } from './doctor';
import { formatCensusReport, formatDoctorReport } from './format';
import { PRODUCT_VERSION } from './version';

interface ParsedOptions {
  command: 'help' | 'version' | 'scan' | 'doctor';
  json: boolean;
  output: string | null;
  includeRuntimes: boolean;
  includeFilesystem: boolean;
  includeAgents: boolean;
  modelDirs: string[];
}

const HELP = `Forkit Census
Metadata-only local AI runtime, model, and agent inventory.

Usage:
  forkit-census scan [options]
  forkit-census report [options]
  forkit-census doctor [--json]
  forkit-census --version

Options:
  --json                 Print a machine-readable Census Report
  --output <file>        Save the selected human or JSON report
  --model-dir <path>     Inspect an explicit model directory; repeatable
  --no-runtimes          Skip local runtime API discovery
  --no-model-files       Skip filesystem model metadata discovery
  --no-agents            Skip local process metadata discovery
  -h, --help             Show this help

Privacy:
  Census reads metadata only. It does not read model bytes, retain raw process
  commands, collect credentials, authenticate to Forkit.dev, or write to any
  passport, registry, Runtime_C2, or production service.
`;

export function parseArgs(args: string[]): ParsedOptions {
  let command: ParsedOptions['command'] = 'help';
  let json = false;
  let output: string | null = null;
  let includeRuntimes = true;
  let includeFilesystem = true;
  let includeAgents = true;
  const modelDirs: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === 'scan' || arg === 'report') command = 'scan';
    else if (arg === 'doctor') command = 'doctor';
    else if (arg === '--version' || arg === '-V' || arg === 'version') command = 'version';
    else if (arg === '--help' || arg === '-h' || arg === 'help') command = 'help';
    else if (arg === '--json') json = true;
    else if (arg === '--no-runtimes') includeRuntimes = false;
    else if (arg === '--no-model-files') includeFilesystem = false;
    else if (arg === '--no-agents') includeAgents = false;
    else if (arg === '--output') {
      output = args[index + 1] ?? null;
      if (!output) throw new Error('--output requires a file path.');
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
    modelDirs,
  };
}

async function emit(output: string, filePath: string | null): Promise<void> {
  process.stdout.write(output);
  if (filePath) await fs.writeFile(filePath, output, { encoding: 'utf8', flag: 'w' });
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
  if (options.command === 'doctor') {
    const report = await runDoctor();
    const rendered = options.json
      ? `${JSON.stringify(report, null, 2)}\n`
      : formatDoctorReport(report);
    await emit(rendered, options.output);
    return report.ok ? 0 : 1;
  }

  const report = await runCensus({
    includeRuntimes: options.includeRuntimes,
    includeFilesystem: options.includeFilesystem,
    includeAgents: options.includeAgents,
    ...(options.modelDirs.length > 0 ? { filesystemRoots: options.modelDirs } : {}),
  });
  const rendered = options.json
    ? `${JSON.stringify(report, null, 2)}\n`
    : formatCensusReport(report);
  await emit(rendered, options.output);
  return 0;
}

if (require.main === module) {
  void main().then((code) => {
    process.exitCode = code;
  }).catch(() => {
    process.stderr.write('Forkit Census failed safely. No raw error details were printed.\n');
    process.exitCode = 1;
  });
}
