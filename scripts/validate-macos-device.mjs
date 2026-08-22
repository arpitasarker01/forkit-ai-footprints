import assert from 'node:assert/strict';
import os from 'node:os';
import { runCensus } from '../dist/census.js';
import { createDefaultProviders } from '../dist/providers/index.js';

assert.equal(process.platform, 'darwin', 'macOS device validation must run on macOS.');

const nativeFetch = globalThis.fetch.bind(globalThis);
const loopbackRequests = [];
const guardedFetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  assert.ok(['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname), `non-loopback request blocked: ${url.hostname}`);
  loopbackRequests.push(`${url.hostname}:${url.port || 'default'}${url.pathname}`);
  return nativeFetch(input, init);
};

function itemSet(items, key) {
  return [...new Set(items.map(key))].sort();
}

function assertNoProhibitedKeys(value) {
  if (Array.isArray(value)) {
    for (const item of value) assertNoProhibitedKeys(item);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!['pid', 'ppid', 'cmd', 'command', 'raw_command', 'absolute_path'].includes(key), `prohibited report key: ${key}`);
    assertNoProhibitedKeys(child);
  }
}

async function scan() {
  return runCensus({ providers: createDefaultProviders(guardedFetch) });
}

const first = await scan();
const second = await scan();
for (const report of [first, second]) {
  assert.equal(report.system.platform, 'darwin');
  assert.deepEqual(report.privacy, {
    mode: 'metadata-only',
    raw_commands_retained: false,
    model_file_contents_read: false,
    config_values_emitted: false,
    sensitive_content_retained: false,
    remote_endpoints_allowed: false,
    external_requests_made: 0,
    backend_contacted: false,
    account_read: false,
    local_state_written: false,
  });
  assertNoProhibitedKeys(report);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes(os.homedir()), false, 'home directory leaked into report');
  for (const agent of report.agents) {
    assert.ok([
      'exact_executable_match',
      'explicit_module_invocation',
      'explicit_package_runner_invocation',
    ].includes(agent.detection_reason), `unsupported agent evidence: ${agent.detection_reason}`);
  }
}

const stable = {
  models: itemSet(first.models, (item) => `${item.runtime}:${item.name}`),
  agents: itemSet(first.agents, (item) => item.signature),
  tools: itemSet(first.tools, (item) => item.name),
  mcp: itemSet(first.mcp_configs, (item) => `${item.client}:${item.server_count}`),
};
assert.deepEqual(stable.models, itemSet(second.models, (item) => `${item.runtime}:${item.name}`));
assert.deepEqual(stable.agents, itemSet(second.agents, (item) => item.signature));
assert.deepEqual(stable.tools, itemSet(second.tools, (item) => item.name));
assert.deepEqual(stable.mcp, itemSet(second.mcp_configs, (item) => `${item.client}:${item.server_count}`));

process.stdout.write(`${JSON.stringify({
  validation: 'macos-real-device',
  platform: first.system.platform,
  architecture: first.system.architecture,
  repeated_inventory_stable: true,
  loopback_request_count: loopbackRequests.length,
  external_request_count: 0,
  summary: first.summary,
  agent_evidence: first.agents.map((agent) => ({
    signature: agent.signature,
    confidence: agent.confidence,
    reason: agent.detection_reason,
  })),
}, null, 2)}\n`);
