#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import http from 'node:http';

const target = new URL(process.argv[2] || process.env.FORKIT_AI_FOOTPRINTS_LOCAL_URL || 'http://127.0.0.1:47811/');
const origin = target.origin;
const results = [];
const residualRisks = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
}

async function request(path, options = {}) {
  const url = new URL(path, origin);
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, text };
}

function extractSessionToken(html) {
  return /"session_token"\s*:\s*"([a-f0-9]{48})"/i.exec(html)?.[1]
    || /const token="([a-f0-9]{48})"/i.exec(html)?.[1]
    || null;
}

function rawHostProbe(hostHeader) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: target.hostname,
      port: Number(target.port),
      path: '/',
      method: 'GET',
      headers: { host: hostHeader },
      timeout: 2000,
    }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', reject);
    req.end();
  });
}

function listenEvidence() {
  if (process.platform !== 'darwin') return 'not checked on non-macOS';
  try {
    return execFileSync('/usr/sbin/lsof', ['-nP', `-iTCP:${target.port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

const page = await request('/');
record('local page loads', page.response.status === 200, `status=${page.response.status}`);
const csp = page.response.headers.get('content-security-policy') || '';
record('strict CSP present', /default-src 'none'/.test(csp) && /connect-src 'self'/.test(csp) && /frame-ancestors 'self'/.test(csp), csp);
record('no CORS allow-origin on page', !page.response.headers.has('access-control-allow-origin'));
const token = extractSessionToken(page.text);
record('session token is strong format', Boolean(token), token ? `${token.length} hex chars` : 'not found');
if (token) residualRisks.push('A same-user local process can fetch the loopback HTML and read the browser session token. This is not remote exposure, but it is not protection against local malware.');

const listen = listenEvidence();
record('service listens on loopback', listen.includes(`127.0.0.1:${target.port}`) && !/TCP \*:/.test(listen), listen || 'no lsof evidence');

const localhost = await fetch(`http://localhost:${target.port}/`).catch((error) => ({ status: 0, error }));
record('localhost host alias rejected', localhost.status === 421, `status=${localhost.status}`);
const poisoned = await rawHostProbe('evil.local');
record('host header poisoning rejected', poisoned === 421, `status=${poisoned}`);

const noToken = await request('/api/monitor/start', { method: 'POST' });
record('browser API rejects missing token', noToken.response.status === 403, `status=${noToken.response.status}`);
if (token) {
  const wrongOrigin = await request('/api/monitor/start', { method: 'POST', headers: { origin: 'http://evil.local', 'x-forkit-footprints-session': token } });
  record('browser API rejects wrong origin', wrongOrigin.response.status === 403, `status=${wrongOrigin.response.status}`);
  const wrongToken = await request('/api/monitor/start', { method: 'POST', headers: { origin, 'x-forkit-footprints-session': '0'.repeat(48) } });
  record('browser API rejects wrong token', wrongToken.response.status === 403, `status=${wrongToken.response.status}`);

  const oversizedLocale = await request('/api/ui/locale', {
    method: 'POST',
    headers: { origin, 'x-forkit-footprints-session': token },
    body: JSON.stringify({ locale: 'en', padding: 'x'.repeat(256) }),
  });
  record('oversized local body rejected', oversizedLocale.response.status === 413, `status=${oversizedLocale.response.status}`);

  const preview = await request('/api/contribution/preview', { method: 'POST', headers: { origin, 'x-forkit-footprints-session': token } });
  const previewAllowedStatus = preview.response.status === 200 || preview.response.status === 409;
  record('contribution preview remains gated', previewAllowedStatus, `status=${preview.response.status}`);
  if (preview.response.status === 200) {
    const forbidden = ['chat', 'workspace', 'process_count', 'cpu_percent', 'memory_bytes', 'device_label', 'census_id', 'generated_at', 'Forkit AI Footprints', 'Forkit_Dev_OS_worktree'];
    const leaked = forbidden.filter((value) => preview.text.includes(value));
    record('aggregate preview excludes private context', leaked.length === 0, leaked.join(', '));
  }
}

const nativeStatus = await request('/api/native/status', { method: 'POST' });
record('native API rejects missing native token', nativeStatus.response.status === 403, `status=${nativeStatus.response.status}`);
const weakNative = await request('/api/native/status', { method: 'POST', headers: { 'x-forkit-footprints-native': 'n'.repeat(16) } });
record('native API rejects weak native token', weakNative.response.status === 403, `status=${weakNative.response.status}`);

const traversal = await request('/../package.json');
record('static path traversal unavailable', traversal.response.status === 404, `status=${traversal.response.status}`);

const failed = results.filter((result) => !result.ok);
console.log(JSON.stringify({
  target: origin,
  validation: 'local-real-service-penetration-smoke',
  passed: failed.length === 0,
  results,
  residualRisks,
}, null, 2));

if (failed.length) process.exitCode = 1;
