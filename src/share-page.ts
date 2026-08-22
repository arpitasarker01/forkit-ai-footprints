import type { CensusReport } from './types';

export interface CensusShareSnapshot {
  product_version: string;
  generated_date: string;
  architecture: string;
  architecture_label: string;
  node_major: number;
  model_record_count: number;
  online_runtime_count: number;
  active_agent_product_count: number;
  high_confidence_agent_count: number;
  agent_process_instance_count: number;
  tool_count: number;
  mcp_config_count: number;
  confirmed_running_model_count: number;
  storage_bucket: string;
  warning_count: number;
  external_request_count: 0;
}

export interface GlobalAiFootprintPulse {
  participating_devices: number;
  model_records: number;
  active_agent_products: number;
  updated_at: string;
  source: 'consented-aggregate';
}

export interface AiFootprintPageOptions {
  globalPulse?: GlobalAiFootprintPulse;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function plural(value: number, singular: string, pluralValue = `${singular}s`): string {
  return value === 1 ? singular : pluralValue;
}

function formatGlobalValue(value: number | undefined): string {
  return value === undefined ? '—' : new Intl.NumberFormat('en-US').format(value);
}

function validateGlobalPulse(pulse: GlobalAiFootprintPulse): void {
  const counts = [pulse.participating_devices, pulse.model_records, pulse.active_agent_products];
  if (pulse.source !== 'consented-aggregate'
    || counts.some((value) => !Number.isSafeInteger(value) || value < 0)
    || !Number.isFinite(Date.parse(pulse.updated_at))) {
    throw new Error('INVALID_GLOBAL_AI_FOOTPRINT_PULSE');
  }
}

export function buildCensusShareSnapshot(report: CensusReport): CensusShareSnapshot {
  const architectureLabel = report.system.architecture === 'arm64'
    ? 'Apple Silicon'
    : report.system.architecture === 'x64'
      ? 'Intel Mac'
      : report.system.architecture;
  const generatedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(report.generated_at));
  return {
    product_version: report.product_version,
    generated_date: generatedDate,
    architecture: report.system.architecture,
    architecture_label: architectureLabel,
    node_major: report.system.node_major,
    model_record_count: report.summary.model_count,
    online_runtime_count: report.summary.available_runtime_count,
    active_agent_product_count: report.summary.agent_product_count,
    high_confidence_agent_count: report.agents.filter((agent) => agent.confidence === 'high').length,
    agent_process_instance_count: report.summary.agent_process_count,
    tool_count: report.summary.tool_count,
    mcp_config_count: report.summary.mcp_config_count,
    confirmed_running_model_count: report.summary.confirmed_running_model_count,
    storage_bucket: report.summary.storage_bucket.replace('-', '–'),
    warning_count: report.summary.warning_count,
    external_request_count: report.privacy.external_requests_made,
  };
}

export function renderCensusSharePage(report: CensusReport, options: AiFootprintPageOptions = {}): string {
  const snapshot = buildCensusShareSnapshot(report);
  const pulse = options.globalPulse;
  if (pulse) validateGlobalPulse(pulse);
  const shareText = [
    `My Mac has ${snapshot.model_record_count} local AI model ${plural(snapshot.model_record_count, 'record')},`,
    `${snapshot.online_runtime_count} active ${plural(snapshot.online_runtime_count, 'runtime')}, and`,
    `${snapshot.active_agent_product_count} active AI agent ${plural(snapshot.active_agent_product_count, 'product')}.`,
    `${snapshot.storage_bucket} model storage. Discovered privately with Forkit AI Footprints.`,
  ].join(' ');
  const safeShareText = JSON.stringify(shareText).replaceAll('<', '\\u003c');
  const localSummary = `${snapshot.model_record_count} model ${plural(snapshot.model_record_count, 'record')} · ${snapshot.online_runtime_count} ${plural(snapshot.online_runtime_count, 'runtime')} · ${snapshot.active_agent_product_count} ${plural(snapshot.active_agent_product_count, 'agent')}`;
  const pulseState = pulse ? 'Live consented aggregate' : 'Opens after opt-in launch';
  const pulseUpdated = pulse
    ? `Updated ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(pulse.updated_at))} UTC`
    : 'No global numbers are fabricated.';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>My AI Footprint · Forkit</title>
  <style>
    :root { --bg:#f5f0e6; --paper:rgba(255,254,250,.76); --ink:#292824; --muted:#6d6961; --line:rgba(45,43,39,.12); --teal:#008190; --orange:#f49355; --green:#2d987b; --shadow:0 24px 70px rgba(45,43,39,.09); }
    * { box-sizing:border-box; }
    html { background:var(--bg); }
    body { margin:0; min-width:320px; color:var(--ink); background:radial-gradient(circle at 0 0,rgba(244,147,85,.18),transparent 29rem),radial-gradient(circle at 100% 0,rgba(0,129,144,.15),transparent 31rem),var(--bg); font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; -webkit-font-smoothing:antialiased; }
    button { font:inherit; }
    .shell { width:min(1040px,calc(100% - 40px)); margin:0 auto; padding:26px 0 34px; }
    .nav { display:flex; justify-content:space-between; align-items:center; margin-bottom:52px; }
    .brand { display:flex; align-items:center; gap:11px; font-size:16px; font-weight:780; letter-spacing:-.03em; }
    .mark { width:34px; height:34px; border-radius:11px; background:linear-gradient(145deg,var(--teal),#6aa7ab 54%,var(--orange)); box-shadow:0 8px 20px rgba(0,129,144,.18); }
    .private { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:12px; font-weight:680; }
    .dot { width:8px; height:8px; border-radius:50%; background:var(--green); box-shadow:0 0 0 5px rgba(45,152,123,.10); }
    .hero { display:grid; grid-template-columns:minmax(0,1.2fr) auto; gap:34px; align-items:end; margin-bottom:30px; }
    .eyebrow { margin:0 0 13px; color:var(--teal); font-size:11px; font-weight:800; letter-spacing:.19em; text-transform:uppercase; }
    h1 { margin:0; max-width:700px; font-size:clamp(58px,8vw,92px); line-height:.89; letter-spacing:-.07em; }
    .summary { margin:22px 0 0; color:var(--muted); font-size:16px; }
    .summary strong { color:var(--ink); }
    .button { min-height:48px; padding:0 20px; border:1px solid var(--teal); border-radius:12px; color:#fff; background:var(--teal); font-weight:760; cursor:pointer; box-shadow:0 12px 26px rgba(0,129,144,.20); }
    .button:hover { transform:translateY(-1px); }
    .status { min-height:17px; margin-top:9px; color:var(--green); font-size:11px; text-align:center; }
    .metrics { display:grid; grid-template-columns:repeat(3,1fr); gap:13px; }
    .metric,.global,.install { border:1px solid var(--line); background:var(--paper); backdrop-filter:blur(20px); box-shadow:var(--shadow); }
    .metric { min-height:160px; padding:23px; border-radius:22px; }
    .metric:nth-child(2) { background:linear-gradient(145deg,rgba(220,236,239,.94),var(--paper)); }
    .metric:nth-child(3) { background:linear-gradient(145deg,rgba(251,230,215,.94),var(--paper)); }
    .label { color:var(--muted); font-size:10px; font-weight:800; letter-spacing:.13em; text-transform:uppercase; }
    .value { margin:19px 0 7px; font-size:49px; line-height:.92; font-weight:780; letter-spacing:-.055em; }
    .value.combo { font-size:30px; line-height:1.08; }
    .note { color:var(--muted); font-size:11px; line-height:1.45; }
    .global { display:grid; grid-template-columns:1fr 1.45fr; gap:30px; align-items:center; margin-top:13px; padding:24px; border-radius:22px; }
    .global h2 { margin:7px 0; font-size:25px; letter-spacing:-.045em; }
    .global p { margin:0; color:var(--muted); font-size:11px; line-height:1.5; }
    .pulse-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:9px; }
    .pulse { padding:13px; border-radius:14px; background:rgba(45,43,39,.035); }
    .pulse strong { display:block; font-size:23px; letter-spacing:-.04em; }
    .pulse span { display:block; margin-top:4px; color:var(--muted); font-size:9px; text-transform:uppercase; letter-spacing:.08em; }
    .install { display:grid; grid-template-columns:.7fr 1.3fr; gap:24px; align-items:center; margin-top:13px; padding:20px 24px; border-radius:22px; }
    .install h2 { margin:6px 0 4px; font-size:20px; letter-spacing:-.035em; }
    .install p { margin:0; color:var(--muted); font-size:10px; }
    .command { position:relative; padding:15px 48px 15px 16px; border-radius:13px; color:#f8f5ed; background:#292824; font:11px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace; white-space:pre-wrap; }
    .copy-install { position:absolute; top:9px; right:9px; min-height:30px; padding:0 10px; border:1px solid rgba(255,255,255,.2); border-radius:8px; color:#fff; background:rgba(255,255,255,.08); font-size:10px; cursor:pointer; }
    footer { display:flex; justify-content:space-between; gap:20px; padding:16px 3px 0; color:var(--muted); font-size:9px; line-height:1.5; }
    @media (max-width:720px) { .nav{margin-bottom:40px}.hero{grid-template-columns:1fr;align-items:start}.hero-action,.button{width:100%}.metrics{grid-template-columns:1fr}.metric{min-height:138px}.global,.install{grid-template-columns:1fr} }
    @media (max-width:440px) { .shell{width:calc(100% - 24px);padding-top:16px}.private{font-size:0}h1{font-size:58px}.pulse-grid{grid-template-columns:1fr}footer{flex-direction:column} }
  </style>
</head>
<body>
  <main class="shell">
    <nav class="nav" aria-label="AI Footprints result header">
      <div class="brand"><span class="mark" aria-hidden="true"></span>Forkit AI Footprints</div>
      <div class="private"><span class="dot" aria-hidden="true"></span>Private scan · zero uploads</div>
    </nav>
    <section class="hero">
      <div><p class="eyebrow">Your Mac · counted locally</p><h1>Your AI.<br>Counted.</h1><p class="summary"><strong>${escapeHtml(localSummary)}</strong> · nothing uploaded.</p></div>
      <div class="hero-action"><button class="button" id="share-button" type="button">Share my footprint</button><div class="status" id="action-status" role="status" aria-live="polite"></div></div>
    </section>
    <section class="metrics" aria-label="Local AI footprint">
      <article class="metric"><div class="label">Model records</div><div class="value">${escapeHtml(snapshot.model_record_count)}</div><div class="note">Metadata evidence, not ownership.</div></article>
      <article class="metric"><div class="label">AI active now</div><div class="value combo">${escapeHtml(snapshot.online_runtime_count)} runtime<br>${escapeHtml(snapshot.active_agent_product_count)} agent</div><div class="note">Responding runtime and active product evidence.</div></article>
      <article class="metric"><div class="label">Local model storage</div><div class="value combo">${escapeHtml(snapshot.storage_bucket)}</div><div class="note">Privacy-safe estimated range.</div></article>
    </section>
    <section class="global" aria-label="Global AI Footprints pulse">
      <div><div class="label">Global AI Pulse · ${escapeHtml(pulseState)}</div><h2>The world's local AI, counted live.</h2><p>${escapeHtml(pulseUpdated)}</p></div>
      <div class="pulse-grid">
        <div class="pulse"><strong>${escapeHtml(formatGlobalValue(pulse?.participating_devices))}</strong><span>Participating devices</span></div>
        <div class="pulse"><strong>${escapeHtml(formatGlobalValue(pulse?.model_records))}</strong><span>Model records</span></div>
        <div class="pulse"><strong>${escapeHtml(formatGlobalValue(pulse?.active_agent_products))}</strong><span>Active agent findings</span></div>
      </div>
    </section>
    <section class="install" aria-label="Install Forkit AI Footprints">
      <div><div class="label">macOS developer preview</div><h2>Make yours visible.</h2><p>Run from the downloaded repository. Public one-command install follows npm approval.</p></div>
      <div class="command" id="install-command">npm ci &amp;&amp; npm run build
node dist/cli.js share-page --output ai-footprint.html &amp;&amp; open ai-footprint.html<button class="copy-install" id="copy-install" type="button">Copy</button></div>
    </section>
    <footer><span>Scanned ${escapeHtml(snapshot.generated_date)} · ${escapeHtml(snapshot.architecture_label)}</span><span>Local inventory only · no proof of safety, provenance, or ownership</span></footer>
  </main>
  <script>
    const shareText = ${safeShareText};
    const status = document.getElementById('action-status');
    async function copyText(text) {
      try { await navigator.clipboard.writeText(text); }
      catch {
        const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
      }
    }
    document.getElementById('share-button').addEventListener('click', async () => {
      if (navigator.share) {
        try { await navigator.share({ title: 'My AI Footprint · Forkit', text: shareText }); status.textContent = 'Shared privately through your device.'; return; }
        catch (error) { if (error && error.name === 'AbortError') return; }
      }
      await copyText(shareText); status.textContent = 'Footprint copied — no private item names included.';
    });
    document.getElementById('copy-install').addEventListener('click', async () => {
      await copyText('npm ci && npm run build\\nnode dist/cli.js share-page --output ai-footprint.html && open ai-footprint.html'); document.getElementById('copy-install').textContent = 'Copied';
    });
  </script>
</body>
</html>`;
}
