import fs from 'node:fs';
import { listSystemProcesses } from './agents';
import { parseLoopbackEndpointList } from './endpoints';
import { getDefaultModelRoots } from './filesystem';
import { PRODUCT_NAME, PRODUCT_VERSION } from './version';

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DoctorReport {
  product: typeof PRODUCT_NAME;
  version: string;
  ok: boolean;
  checks: DoctorCheck[];
}

export async function runDoctor(): Promise<DoctorReport> {
  const nodeMajor = Number(process.versions.node.split('.')[0] ?? 0);
  const supportedNode = [20, 22, 24].includes(nodeMajor);
  const rawEndpoints = process.env.FORKIT_CENSUS_OPENAI_ENDPOINTS ?? 'http://localhost:8000';
  const endpointCandidates = rawEndpoints.split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean);
  const safeEndpoints = parseLoopbackEndpointList(rawEndpoints);
  let processInventoryOk = true;
  try {
    await listSystemProcesses();
  } catch {
    processInventoryOk = false;
  }
  const existingModelRoots = getDefaultModelRoots().filter((root) => {
    try {
      return fs.statSync(root).isDirectory();
    } catch {
      return false;
    }
  }).length;
  const checks: DoctorCheck[] = [
    {
      name: 'operating-system',
      ok: process.platform === 'darwin',
      detail: process.platform === 'darwin'
        ? 'macOS is supported by this release candidate.'
        : `This release candidate supports macOS only; detected ${process.platform}.`,
    },
    {
      name: 'node-version',
      ok: supportedNode,
      detail: supportedNode ? `Node ${nodeMajor} is supported.` : `Node ${nodeMajor} is unsupported; use 20, 22, or 24.`,
    },
    {
      name: 'process-inventory',
      ok: processInventoryOk,
      detail: processInventoryOk ? 'Process metadata can be enumerated.' : 'Process metadata cannot be enumerated.',
    },
    {
      name: 'loopback-only-endpoints',
      ok: safeEndpoints.length === endpointCandidates.length,
      detail: safeEndpoints.length === endpointCandidates.length
        ? `${safeEndpoints.length} configured endpoint(s) are loopback-only.`
        : 'One or more configured endpoints were rejected because Census only allows loopback HTTP(S).',
    },
    {
      name: 'model-roots',
      ok: true,
      detail: `${existingModelRoots} known model root(s) currently exist; zero is allowed.`,
    },
  ];
  return {
    product: PRODUCT_NAME,
    version: PRODUCT_VERSION,
    ok: checks.every((check) => check.ok),
    checks,
  };
}
