import type { CensusReport } from './types';

export interface CensusShareSnapshot {
  generated_date: string;
  architecture_label: string;
  model_record_count: number;
  online_runtime_count: number;
  active_agent_product_count: number;
  active_agent_process_count: number;
  agent_cpu_percent: number | null;
  agent_memory_percent: number | null;
  confirmed_running_model_count: number;
  model_storage_display: string;
  storage_bucket: string;
  external_request_count: 0;
}

export interface LocalRescanOptions {
  endpoint: string;
  stop_endpoint: string;
  session_token: string;
}

export interface AiFootprintPageOptions {
  rescan?: LocalRescanOptions;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeScriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function formatStorage(bytes: number): string {
  if (bytes <= 0) return '0 GB';
  const gib = bytes / (1024 ** 3);
  if (gib < 0.1) return `${Math.max(1, Math.round(bytes / (1024 ** 2)))} MB`;
  return `${gib < 10 ? gib.toFixed(2) : gib.toFixed(1)} GB`;
}

function validateRescanOptions(rescan: LocalRescanOptions): void {
  if (!rescan.endpoint.startsWith('/') || rescan.endpoint.startsWith('//')
    || !rescan.stop_endpoint.startsWith('/') || rescan.stop_endpoint.startsWith('//')
    || !/^[a-f0-9]{48}$/.test(rescan.session_token)) {
    throw new Error('INVALID_LOCAL_RESCAN_OPTIONS');
  }
}

export function buildCensusShareSnapshot(report: CensusReport): CensusShareSnapshot {
  const architectureLabel = report.system.architecture === 'arm64'
    ? 'Apple Silicon'
    : report.system.architecture === 'x64'
      ? 'Intel Mac'
      : report.system.architecture;
  const generatedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(report.generated_at));
  return {
    generated_date: generatedDate,
    architecture_label: architectureLabel,
    model_record_count: report.summary.model_count,
    online_runtime_count: report.summary.available_runtime_count,
    active_agent_product_count: report.summary.agent_product_count,
    active_agent_process_count: report.summary.agent_process_count,
    agent_cpu_percent: report.summary.agent_cpu_percent,
    agent_memory_percent: report.summary.agent_memory_percent,
    confirmed_running_model_count: report.summary.confirmed_running_model_count,
    model_storage_display: formatStorage(report.summary.storage_bytes),
    storage_bucket: report.summary.storage_bucket.replace('-', '–'),
    external_request_count: report.privacy.external_requests_made,
  };
}

export function renderCensusSharePage(report: CensusReport, options: AiFootprintPageOptions = {}): string {
  const snapshot = buildCensusShareSnapshot(report);
  const rescan = options.rescan;
  if (rescan) validateRescanOptions(rescan);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>My AI Footprint · Forkit</title>
  <style>
    :root { --bg:#f5f0e6; --paper:rgba(255,254,250,.78); --ink:#292824; --muted:#6d6961; --line:rgba(45,43,39,.12); --teal:#008190; --orange:#f49355; --green:#2d987b; --shadow:0 24px 70px rgba(45,43,39,.09); }
    * { box-sizing:border-box; }
    html { background:var(--bg); }
    body { margin:0; min-width:320px; color:var(--ink); background:radial-gradient(circle at 0 0,rgba(244,147,85,.18),transparent 29rem),radial-gradient(circle at 100% 0,rgba(0,129,144,.15),transparent 31rem),var(--bg); font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; -webkit-font-smoothing:antialiased; }
    body.dialog-open { overflow:hidden; }
    button,input { font:inherit; }
    [hidden] { display:none !important; }
    .shell { width:min(1040px,calc(100% - 40px)); margin:0 auto; padding:26px 0 34px; }
    .nav { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
    .brand { display:flex; align-items:center; gap:11px; font-size:16px; font-weight:780; letter-spacing:-.03em; }
    .mark { width:34px; height:34px; border-radius:11px; background:linear-gradient(145deg,var(--teal),#6aa7ab 54%,var(--orange)); box-shadow:0 8px 20px rgba(0,129,144,.18); }
    .private { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:12px; font-weight:680; }
    .dot { width:8px; height:8px; border-radius:50%; background:var(--green); box-shadow:0 0 0 5px rgba(45,152,123,.10); }
    .measures { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:38px; }
    .measure { padding:13px 15px; border:1px solid var(--line); border-radius:15px; background:rgba(255,254,250,.56); }
    .measure strong { display:block; font-size:12px; }
    .measure span { display:block; margin-top:4px; color:var(--muted); font-size:9px; line-height:1.4; }
    .hero { display:grid; grid-template-columns:minmax(0,1.04fr) minmax(350px,.96fr); gap:30px; align-items:end; margin-bottom:18px; }
    .eyebrow { margin:0 0 13px; color:var(--teal); font-size:11px; font-weight:800; letter-spacing:.19em; text-transform:uppercase; }
    h1 { margin:0; max-width:650px; font-size:clamp(58px,7.6vw,88px); line-height:.89; letter-spacing:-.07em; }
    .summary { margin:20px 0 0; color:var(--muted); font-size:15px; }
    .guess-card,.metric { border:1px solid var(--line); background:var(--paper); backdrop-filter:blur(20px); box-shadow:var(--shadow); }
    .guess-card { padding:21px; border-radius:22px; }
    .label { color:var(--muted); font-size:10px; font-weight:800; letter-spacing:.13em; text-transform:uppercase; }
    .guess-title { margin:7px 0 13px; font-size:20px; letter-spacing:-.035em; }
    .guess-row { display:grid; grid-template-columns:1fr auto; gap:9px; }
    .guess-input { width:100%; min-height:46px; border:1px solid var(--line); border-radius:12px; padding:0 14px; color:var(--ink); background:#fffefa; font-weight:750; outline:none; }
    .guess-input:focus { border-color:var(--teal); box-shadow:0 0 0 3px rgba(0,129,144,.10); }
    .button { min-height:46px; padding:0 17px; border:1px solid var(--teal); border-radius:12px; color:#fff; background:var(--teal); font-weight:760; cursor:pointer; box-shadow:0 10px 22px rgba(0,129,144,.17); }
    .button.secondary { border-color:var(--line); color:var(--ink); background:#eee8df; box-shadow:none; }
    .button:disabled { cursor:wait; opacity:.65; }
    .guess-result { min-height:34px; margin:11px 0 0; color:var(--muted); font-size:12px; line-height:1.45; }
    .actions { display:flex; gap:8px; margin-top:12px; }
    .actions .button { flex:1; min-height:40px; font-size:12px; }
    .status { min-height:16px; margin-top:8px; color:var(--green); font-size:10px; }
    .metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:13px; }
    .metric { min-height:145px; padding:21px; border-radius:22px; }
    .metric:nth-child(2) { background:linear-gradient(145deg,rgba(220,236,239,.94),var(--paper)); }
    .metric:nth-child(3) { background:linear-gradient(145deg,rgba(251,230,215,.94),var(--paper)); }
    .metric:nth-child(4) { background:linear-gradient(145deg,rgba(230,238,222,.94),var(--paper)); }
    .value { margin:17px 0 7px; font-size:46px; line-height:.92; font-weight:780; letter-spacing:-.055em; }
    .value.combo { font-size:27px; line-height:1.08; }
    .note { color:var(--muted); font-size:11px; line-height:1.45; }
    .share-dialog { width:min(760px,calc(100% - 28px)); max-height:calc(100vh - 28px); margin:auto; padding:0; border:1px solid rgba(255,255,255,.75); border-radius:26px; color:var(--ink); background:#fffefa; box-shadow:0 32px 100px rgba(28,36,34,.28); overflow:auto; }
    .share-dialog::backdrop { background:rgba(25,31,30,.52); backdrop-filter:blur(9px); }
    .share-studio { padding:22px; }
    .share-head { display:flex; align-items:start; justify-content:space-between; gap:18px; margin-bottom:16px; }
    .share-head h2 { margin:5px 0 0; font-size:24px; letter-spacing:-.04em; }
    .icon-button { width:36px; height:36px; border:1px solid var(--line); border-radius:11px; color:var(--ink); background:#f3ede3; cursor:pointer; font-size:19px; }
    .canvas-shell { padding:8px; border:1px solid var(--line); border-radius:18px; background:#ece7dd; }
    #share-canvas { display:block; width:100%; height:auto; border-radius:12px; background:#f5f0e6; }
    .share-actions { display:flex; gap:10px; margin-top:16px; }
    .share-actions .button { flex:1; }
    .share-note { margin:12px 0 0; color:var(--muted); font-size:10px; line-height:1.5; text-align:center; }
    footer { display:flex; justify-content:space-between; gap:20px; padding:15px 3px 0; color:var(--muted); font-size:9px; line-height:1.5; }
    @media (max-width:900px) { .metrics{grid-template-columns:repeat(2,1fr)} }
    @media (max-width:760px) { .measures{grid-template-columns:1fr;margin-bottom:30px}.hero{grid-template-columns:1fr;align-items:start}.metrics{grid-template-columns:1fr}.metric{min-height:130px} }
    @media (max-width:440px) { .shell{width:calc(100% - 24px);padding-top:16px}.private{font-size:0}h1{font-size:58px}.guess-row{grid-template-columns:1fr}.actions,.share-actions{flex-direction:column}footer{flex-direction:column}.share-studio{padding:15px} }
  </style>
</head>
<body>
  <main class="shell">
    <nav class="nav" aria-label="AI Footprints result header">
      <div class="brand"><span class="mark" aria-hidden="true"></span>Forkit AI Footprints</div>
      <div class="private"><span class="dot" aria-hidden="true"></span>Metadata only · stays on this device</div>
    </nav>
    <section class="measures" aria-label="What this local scan measures">
      <article class="measure"><strong>Models</strong><span>Metadata records, loaded-state evidence, and model-file disk use.</span></article>
      <article class="measure"><strong>Runtimes</strong><span>Only supported services responding on this Mac through loopback.</span></article>
      <article class="measure"><strong>Agents</strong><span>Strong process evidence plus point-in-time CPU and memory percentages.</span></article>
    </section>
    <section class="hero">
      <div><p class="eyebrow">Your Mac · private local scan</p><h1>Guess.<br>Then know.</h1><p class="summary" id="summary">The scan is complete. Guess before the local facts are revealed.</p></div>
      <aside class="guess-card" aria-label="Guess your local model count">
        <div class="label">Your guess</div><h2 class="guess-title">How many model records are hiding on this Mac?</h2>
        <div class="guess-row"><input class="guess-input" id="guess-input" type="number" inputmode="numeric" min="0" max="100000" step="1" placeholder="e.g. 5" aria-label="Guessed local model record count"><button class="button" id="reveal-button" type="button">Reveal my footprint</button></div>
        <p class="guess-result" id="guess-result">Your guess never leaves this page.</p>
        <div class="actions" id="result-actions" hidden><button class="button" id="share-button" type="button">Create share card</button>${rescan ? '<button class="button secondary" id="scan-button" type="button">Scan again</button><button class="button secondary" id="stop-button" type="button">Close local scan</button>' : ''}</div>
        <div class="status" id="action-status" role="status" aria-live="polite"></div>
      </aside>
    </section>
    <section class="metrics" aria-label="Local AI footprint" aria-live="polite">
      <article class="metric"><div class="label">Model records</div><div class="value" id="model-value">?</div><div class="note">Metadata evidence, not ownership.</div></article>
      <article class="metric"><div class="label">Model activity now</div><div class="value combo"><span id="runtime-value">?</span> runtime<br><span id="loaded-model-value">?</span> loaded model</div><div class="note">Loopback response and runtime loaded-state evidence.</div></article>
      <article class="metric"><div class="label">Model disk use</div><div class="value combo" id="storage-value">?</div><div class="note" id="storage-note">Exact recognized file total; model bytes are never read.</div></article>
      <article class="metric"><div class="label">Agent activity now</div><div class="value combo"><span id="agent-value">?</span> product<br><span id="agent-process-value">?</span> processes</div><div class="note" id="agent-resource-value">Point-in-time CPU and memory snapshot.</div></article>
    </section>
    <footer><span>Scan stays in memory · <span id="scan-date">${escapeHtml(snapshot.generated_date)}</span> · ${escapeHtml(snapshot.architecture_label)}</span><span>No weights, prompts, commands, config values, or account data</span></footer>
  </main>
  <dialog class="share-dialog" id="share-dialog" aria-labelledby="share-title">
    <div class="share-studio">
      <div class="share-head"><div><div class="label">Your discovery card</div><h2 id="share-title">AI hiding in plain sight.</h2></div><button class="icon-button" id="close-share" type="button" aria-label="Close share card">×</button></div>
      <div class="canvas-shell"><canvas id="share-canvas" width="1200" height="630" aria-label="Generated Forkit AI Footprints discovery card"></canvas></div>
      <div class="share-actions"><button class="button" id="share-image" type="button">Share image</button><button class="button secondary" id="download-image" type="button">Download PNG</button><button class="button secondary" id="copy-share" type="button">Copy caption</button></div>
      <p class="share-note">Created entirely on this device from aggregate counts. No item names or scan data are uploaded.</p>
    </div>
  </dialog>
  <script>
    let currentSnapshot = ${safeScriptJson(snapshot)};
    const rescanConfig = ${safeScriptJson(rescan ?? null)};
    const status = document.getElementById('action-status');
    const guessInput = document.getElementById('guess-input');
    const shareDialog = document.getElementById('share-dialog');
    const shareCanvas = document.getElementById('share-canvas');
    let revealed = false;
    function plural(value, singular, pluralValue) { return value === 1 ? singular : (pluralValue || singular + 's'); }
    function currentGuess() { const value = Number(guessInput.value); return Number.isSafeInteger(value) && value >= 0 ? value : null; }
    function agentResourceText() {
      if (currentSnapshot.agent_cpu_percent === null || currentSnapshot.agent_memory_percent === null) return 'Agent CPU and memory snapshot unavailable';
      return currentSnapshot.agent_cpu_percent.toFixed(1) + '% CPU · ' + currentSnapshot.agent_memory_percent.toFixed(1) + '% memory';
    }
    function inspiration() {
      const models = currentSnapshot.model_record_count;
      if (models === 0) return { line1:'A clear Mac.', line2:'A deliberate start.', title:'Every AI journey starts somewhere.' };
      if (models <= 3) return { line1:'A small constellation.', line2:'A real beginning.', title:'A few discoveries can change what you build.' };
      if (models <= 9) return { line1:'Your Mac is already', line2:'an AI workshop.', title:'More intelligence was hiding in plain sight.' };
      return { line1:'Not just using AI.', line2:'Building an ecosystem.', title:'Your local AI world is bigger than it looks.' };
    }
    function shareText() {
      const guess = currentGuess();
      const prefix = guess === null ? '' : 'I guessed ' + guess + '. ';
      return inspiration().title + ' ' + prefix + 'Forkit AI Footprints found ' + currentSnapshot.model_record_count + ' local model ' + plural(currentSnapshot.model_record_count, 'record') + ', ' + currentSnapshot.confirmed_running_model_count + ' loaded, ' + currentSnapshot.online_runtime_count + ' responding ' + plural(currentSnapshot.online_runtime_count, 'runtime') + ', and ' + currentSnapshot.active_agent_product_count + ' active AI agent ' + plural(currentSnapshot.active_agent_product_count, 'product') + ' across ' + currentSnapshot.active_agent_process_count + ' ' + plural(currentSnapshot.active_agent_process_count, 'process', 'processes') + '. Recognized model files use ' + currentSnapshot.model_storage_display + '. ' + agentResourceText() + ' at scan time. Metadata only; nothing uploaded.';
    }
    function roundedRect(context, x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      context.beginPath(); context.moveTo(x + r, y); context.arcTo(x + width, y, x + width, y + height, r); context.arcTo(x + width, y + height, x, y + height, r); context.arcTo(x, y + height, x, y, r); context.arcTo(x, y, x + width, y, r); context.closePath();
    }
    function drawShareCard() {
      const context = shareCanvas.getContext('2d');
      const guess = currentGuess();
      const actual = currentSnapshot.model_record_count;
      const difference = guess === null ? null : actual - guess;
      const message = inspiration();
      context.clearRect(0, 0, 1200, 630);
      const background = context.createLinearGradient(0, 0, 1200, 630); background.addColorStop(0, '#f8eee1'); background.addColorStop(.48, '#f5f0e6'); background.addColorStop(1, '#d8ecec'); context.fillStyle = background; context.fillRect(0, 0, 1200, 630);
      const glowA = context.createRadialGradient(110, 90, 5, 110, 90, 270); glowA.addColorStop(0, 'rgba(244,147,85,.34)'); glowA.addColorStop(1, 'rgba(244,147,85,0)'); context.fillStyle = glowA; context.fillRect(0, 0, 430, 400);
      const glowB = context.createRadialGradient(1040, 90, 5, 1040, 90, 320); glowB.addColorStop(0, 'rgba(0,129,144,.24)'); glowB.addColorStop(1, 'rgba(0,129,144,0)'); context.fillStyle = glowB; context.fillRect(700, 0, 500, 440);
      context.save(); context.translate(925, 310); context.strokeStyle = 'rgba(0,129,144,.15)'; context.lineWidth = 2;
      for (let ring = 1; ring <= 3; ring += 1) { context.beginPath(); context.arc(0, 0, ring * 76, 0, Math.PI * 2); context.stroke(); }
      const nodeCount = Math.max(3, Math.min(18, actual + currentSnapshot.online_runtime_count + currentSnapshot.active_agent_product_count));
      for (let index = 0; index < nodeCount; index += 1) { const angle = (Math.PI * 2 * index / nodeCount) - Math.PI / 2; const radius = 76 + (index % 3) * 76; const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius; context.beginPath(); context.arc(x, y, index % 3 === 0 ? 11 : 7, 0, Math.PI * 2); context.fillStyle = index % 3 === 0 ? '#f49355' : '#008190'; context.fill(); }
      context.beginPath(); context.arc(0, 0, 53, 0, Math.PI * 2); context.fillStyle = '#fffefa'; context.fill(); context.strokeStyle = 'rgba(45,43,39,.10)'; context.stroke(); context.fillStyle = '#292824'; context.font = '800 33px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.textAlign = 'center'; context.fillText(String(actual), 0, 12); context.restore();
      context.textAlign = 'left'; context.fillStyle = '#008190'; context.font = '800 19px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText('FORKIT AI FOOTPRINTS  ·  PRIVATE LOCAL DISCOVERY', 64, 61);
      context.fillStyle = '#292824'; context.font = '800 55px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(message.line1, 64, 145); context.fillText(message.line2, 64, 205);
      context.fillStyle = '#6d6961'; context.font = '600 20px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(actual + ' model ' + plural(actual, 'record') + ' · ' + currentSnapshot.active_agent_product_count + ' active ' + plural(currentSnapshot.active_agent_product_count, 'agent') + ' · ' + currentSnapshot.model_storage_display + ' on disk', 64, 249);
      roundedRect(context, 64, 285, 510, 137, 25); context.fillStyle = 'rgba(255,254,250,.76)'; context.fill(); context.strokeStyle = 'rgba(45,43,39,.10)'; context.stroke();
      context.fillStyle = '#6d6961'; context.font = '800 16px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText('MY GUESS', 91, 320); context.fillText('DISCOVERED', 322, 320);
      context.fillStyle = '#292824'; context.font = '800 68px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(String(guess), 91, 387); context.fillStyle = '#008190'; context.fillText('→  ' + actual, 235, 387);
      context.fillStyle = difference === 0 ? '#2d987b' : '#a9582d'; context.font = '750 16px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(difference === 0 ? 'Exactly right.' : Math.abs(difference) + (difference > 0 ? ' more than I expected.' : ' fewer than I expected.'), 91, 410);
      const cards = [[String(actual), 'MODEL RECORDS'], [String(currentSnapshot.confirmed_running_model_count), 'LOADED MODEL' + (currentSnapshot.confirmed_running_model_count === 1 ? '' : 'S')], [String(currentSnapshot.active_agent_process_count), 'AGENT PROCESS' + (currentSnapshot.active_agent_process_count === 1 ? '' : 'ES')], [currentSnapshot.model_storage_display, 'MODEL DISK USE']];
      cards.forEach((card, index) => { const x = 64 + index * 263; roundedRect(context, x, 453, 244, 91, 19); context.fillStyle = index % 2 === 0 ? 'rgba(255,254,250,.78)' : 'rgba(220,236,239,.72)'; context.fill(); context.strokeStyle = 'rgba(45,43,39,.10)'; context.stroke(); context.fillStyle = '#292824'; context.font = '800 29px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(card[0], x + 18, 493); context.fillStyle = '#6d6961'; context.font = '800 12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(card[1], x + 18, 522); });
      context.fillStyle = '#292824'; context.font = '800 15px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(actual > 0 ? 'LOCAL AI EXPLORER' : 'AI CURIOUS', 64, 588);
      context.fillStyle = '#6d6961'; context.font = '600 13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(agentResourceText() + '  ·  Metadata only  ·  Nothing uploaded', 290, 588);
    }
    function canvasBlob() { return new Promise((resolve) => shareCanvas.toBlob(resolve, 'image/png')); }
    async function openShareStudio() { drawShareCard(); document.getElementById('share-title').textContent = inspiration().title; document.body.classList.add('dialog-open'); shareDialog.showModal(); }
    function closeShareStudio() { shareDialog.close(); document.body.classList.remove('dialog-open'); }
    function renderActual() {
      revealed = true;
      document.getElementById('model-value').textContent = String(currentSnapshot.model_record_count);
      document.getElementById('runtime-value').textContent = String(currentSnapshot.online_runtime_count);
      document.getElementById('loaded-model-value').textContent = String(currentSnapshot.confirmed_running_model_count);
      document.getElementById('agent-value').textContent = String(currentSnapshot.active_agent_product_count);
      document.getElementById('agent-process-value').textContent = String(currentSnapshot.active_agent_process_count);
      document.getElementById('storage-value').textContent = currentSnapshot.model_storage_display;
      document.getElementById('storage-note').textContent = currentSnapshot.storage_bucket + ' privacy band · recognized model files only.';
      document.getElementById('agent-resource-value').textContent = agentResourceText() + ' · point in time.';
      document.getElementById('scan-date').textContent = currentSnapshot.generated_date;
      document.getElementById('summary').innerHTML = '<strong>' + inspiration().title + '</strong><br>' + currentSnapshot.model_record_count + ' model ' + plural(currentSnapshot.model_record_count, 'record') + ' · ' + currentSnapshot.confirmed_running_model_count + ' loaded · ' + currentSnapshot.active_agent_product_count + ' active ' + plural(currentSnapshot.active_agent_product_count, 'agent') + ' · ' + currentSnapshot.model_storage_display + ' on disk.';
      document.getElementById('result-actions').hidden = false;
    }
    function compareGuess() {
      const guess = currentGuess();
      if (guess === null) { document.getElementById('guess-result').textContent = 'Enter a whole number from 0 to 100,000.'; return false; }
      renderActual();
      const difference = currentSnapshot.model_record_count - guess;
      document.getElementById('guess-result').textContent = difference === 0
        ? 'Exactly right — this Mac has ' + currentSnapshot.model_record_count + ' model ' + plural(currentSnapshot.model_record_count, 'record') + '.'
        : difference > 0
          ? 'Actual: ' + currentSnapshot.model_record_count + '. You discovered ' + difference + ' more than expected.'
          : 'Actual: ' + currentSnapshot.model_record_count + '. Your guess was ' + Math.abs(difference) + ' higher.';
      return true;
    }
    async function copyText(text) {
      try { await navigator.clipboard.writeText(text); }
      catch { const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); }
    }
    document.getElementById('reveal-button').addEventListener('click', compareGuess);
    guessInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') compareGuess(); });
    document.getElementById('share-button').addEventListener('click', openShareStudio);
    document.getElementById('close-share').addEventListener('click', closeShareStudio);
    shareDialog.addEventListener('click', (event) => { if (event.target === shareDialog) closeShareStudio(); });
    document.getElementById('download-image').addEventListener('click', async () => { const blob = await canvasBlob(); if (!blob) return; const link = document.createElement('a'); link.download='my-forkit-ai-footprint.png'; link.href=URL.createObjectURL(blob); link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); document.getElementById('download-image').textContent='Downloaded'; });
    document.getElementById('share-image').addEventListener('click', async () => { const blob = await canvasBlob(); if (!blob) return; const file = new File([blob], 'my-forkit-ai-footprint.png', { type:'image/png' }); if (navigator.share && (!navigator.canShare || navigator.canShare({ files:[file] }))) { try { await navigator.share({ title:'My AI Footprint · Forkit', text:shareText(), files:[file] }); return; } catch (error) { if (error && error.name === 'AbortError') return; } } await copyText(shareText()); document.getElementById('share-image').textContent='Caption copied'; });
    document.getElementById('copy-share').addEventListener('click', async () => { await copyText(shareText()); document.getElementById('copy-share').textContent='Caption copied'; });
    if (rescanConfig) document.getElementById('scan-button').addEventListener('click', async () => {
      const button = document.getElementById('scan-button'); button.disabled = true; button.textContent = 'Scanning…'; status.textContent = 'Reading local metadata again…';
      try {
        const response = await fetch(rescanConfig.endpoint, { method:'POST', headers:{ 'accept':'application/json', 'x-forkit-footprints-session':rescanConfig.session_token } });
        if (!response.ok) throw new Error('SCAN_FAILED');
        currentSnapshot = await response.json(); renderActual(); compareGuess(); status.textContent = 'Fresh local scan complete. Nothing was uploaded.';
      } catch { status.textContent = 'Scan could not complete. Your previous local result is unchanged.'; }
      finally { button.disabled = false; button.textContent = 'Scan again'; }
    });
    if (rescanConfig) document.getElementById('stop-button').addEventListener('click', async () => {
      const button = document.getElementById('stop-button'); button.disabled = true; button.textContent = 'Closing…';
      try {
        const response = await fetch(rescanConfig.stop_endpoint, { method:'POST', headers:{ 'accept':'application/json', 'x-forkit-footprints-session':rescanConfig.session_token } });
        if (!response.ok) throw new Error('STOP_FAILED');
        document.body.innerHTML = '<main class="shell"><section class="guess-card"><div class="label">Forkit AI Footprints</div><h1 style="font-size:48px;line-height:1;margin-top:18px">Local scan closed.</h1><p class="summary">The private service has stopped. You can close this tab.</p></section></main>';
      } catch { button.disabled = false; button.textContent = 'Close local scan'; status.textContent = 'The local service is still running.'; }
    });
  </script>
</body>
</html>`;
}
