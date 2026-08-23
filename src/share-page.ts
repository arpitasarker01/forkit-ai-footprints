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
  model_storage_bytes: number;
  model_storage_display: string;
  model_storage_complete: boolean;
  model_storage_measurement: 'recognized-logical-file-bytes';
  external_request_count: 0;
}

export interface LocalRescanOptions {
  endpoint: string;
  live_endpoint: string;
  stop_endpoint: string;
  observe_start_endpoint: string;
  observe_stop_endpoint: string;
  session_token: string;
}

export interface AiFootprintPageOptions {
  rescan?: LocalRescanOptions;
  localDeviceLabel?: string;
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
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes;
  let unit = 0;
  while (unit < units.length - 1 && value >= 1024) {
    value /= 1024;
    unit += 1;
  }
  const digits = value < 10 && unit > 1 ? 2 : value < 100 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

function validateRescanOptions(rescan: LocalRescanOptions): void {
  if (!rescan.endpoint.startsWith('/') || rescan.endpoint.startsWith('//')
    || !rescan.live_endpoint.startsWith('/') || rescan.live_endpoint.startsWith('//')
    || !rescan.stop_endpoint.startsWith('/') || rescan.stop_endpoint.startsWith('//')
    || !rescan.observe_start_endpoint.startsWith('/') || rescan.observe_start_endpoint.startsWith('//')
    || !rescan.observe_stop_endpoint.startsWith('/') || rescan.observe_stop_endpoint.startsWith('//')
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
    model_storage_bytes: report.summary.storage_bytes,
    model_storage_display: formatStorage(report.summary.storage_bytes),
    model_storage_complete: report.summary.storage_complete,
    model_storage_measurement: report.summary.storage_measurement,
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
    .lane-nav { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:28px; padding:7px; border:1px solid var(--line); border-radius:17px; background:rgba(255,254,250,.58); }
    .lane-button { min-height:42px; border:0; border-radius:12px; color:var(--muted); background:transparent; font-weight:780; cursor:pointer; }
    .lane-button[aria-selected="true"] { color:#fff; background:var(--teal); box-shadow:0 9px 22px rgba(0,129,144,.17); }
    .lane-panel[hidden] { display:none !important; }
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
    .observer { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:20px; align-items:center; margin-top:13px; padding:20px 22px; border:1px solid var(--line); border-radius:22px; background:rgba(255,254,250,.74); box-shadow:var(--shadow); }
    .observer h2 { margin:6px 0 5px; font-size:22px; letter-spacing:-.04em; }
    .observer p { margin:0; max-width:700px; color:var(--muted); font-size:11px; line-height:1.5; }
    .observer-actions { display:flex; align-items:center; gap:10px; }
    .observer-result { margin-top:7px !important; color:var(--teal) !important; font-weight:720; }
    .evolution { margin-top:13px; padding:27px; border:1px solid var(--line); border-radius:24px; background:var(--paper); box-shadow:var(--shadow); }
    .evolution-grid { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr); gap:18px; align-items:stretch; }
    .chapter-card { display:flex; min-height:190px; flex-direction:column; justify-content:space-between; padding:24px; border-radius:20px; color:#fff; background:linear-gradient(145deg,#007b87,#2d987b 55%,#f49355); }
    .chapter-card .label { color:rgba(255,255,255,.72); }
    .chapter-name { margin:12px 0 0; font-size:38px; line-height:1; letter-spacing:-.055em; }
    .chapter-copy { margin:15px 0 0; color:rgba(255,255,255,.82); font-size:12px; line-height:1.5; }
    .history-card { padding:22px; border:1px solid var(--line); border-radius:20px; background:rgba(255,254,250,.68); }
    .history-card h2 { margin:7px 0 8px; font-size:24px; letter-spacing:-.04em; }
    .history-card p { margin:0; color:var(--muted); font-size:11px; line-height:1.55; }
    .history-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }
    .history-actions .button { min-height:40px; font-size:12px; }
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
    @media (max-width:760px) { .measures{grid-template-columns:1fr;margin-bottom:30px}.hero{grid-template-columns:1fr;align-items:start}.metrics{grid-template-columns:1fr}.metric{min-height:130px}.observer,.evolution-grid{grid-template-columns:1fr}.observer-actions{align-items:stretch}.observer-actions .button{flex:1} }
    @media (max-width:440px) { .shell{width:calc(100% - 24px);padding-top:16px}.private{font-size:0}h1{font-size:58px}.guess-row{grid-template-columns:1fr}.actions,.share-actions{flex-direction:column}footer{flex-direction:column}.share-studio{padding:15px} }
  </style>
</head>
<body>
  <main class="shell">
    <nav class="nav" aria-label="AI Footprints result header">
      <div class="brand"><span class="mark" aria-hidden="true"></span>Forkit AI Footprints</div>
      <div class="private"><span class="dot" aria-hidden="true"></span>Metadata only · stays on this device</div>
    </nav>
    <nav class="lane-nav" aria-label="AI Footprints views">
      <button class="lane-button" type="button" data-lane="discover" aria-selected="true">Discover</button>
      <button class="lane-button" type="button" data-lane="observe" aria-selected="false">Observe</button>
      <button class="lane-button" type="button" data-lane="evolution" aria-selected="false">Evolution</button>
    </nav>
    <section class="lane-panel" id="discover-panel">
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
      <article class="metric"><div class="label">Model activity now</div><div class="value combo"><span id="runtime-value">?</span> runtime<br><span id="loaded-model-value">?</span> loaded model</div><div class="note" id="live-note">Loopback response and runtime loaded-state evidence.</div></article>
      <article class="metric"><div class="label">Model disk use</div><div class="value combo" id="storage-value">?</div><div class="note" id="storage-note">Exact recognized logical-file total when coverage is complete; model bytes are never read.</div></article>
      <article class="metric"><div class="label">Agent activity now</div><div class="value combo"><span id="agent-value">?</span> product<br><span id="agent-process-value">?</span> processes</div><div class="note" id="agent-resource-value">Point-in-time CPU and memory snapshot.</div></article>
    </section>
    </section>
    ${rescan ? '<section class="observer lane-panel" id="observe-panel" hidden><div><div class="label">Observe</div><h2>Measure one AI task</h2><p>Start, perform one task, then stop. Forkit samples strongly detected agent processes and reports the window average and peak. Shared-process background activity may be included.</p><p class="observer-result" id="observer-result">Ready when you are.</p></div><div class="observer-actions"><button class="button" id="observe-button" type="button">Start observation</button><button class="button secondary" id="observe-share-button" type="button" hidden>Share task</button></div></section>' : '<section class="observer lane-panel" id="observe-panel" hidden><div><div class="label">Observe</div><h2>Task observation opens from the Mac app.</h2><p>This saved page contains discovery results only.</p></div></section>'}
    <section class="evolution lane-panel" id="evolution-panel" hidden>
      <div class="evolution-grid">
        <div class="chapter-card"><div><div class="label">Your current chapter</div><h2 class="chapter-name" id="chapter-name">Reveal to begin</h2><p class="chapter-copy" id="chapter-copy">Your chapter reflects visible local activity, not a score.</p></div><div class="label" id="chapter-change">No private history saved</div></div>
        <div class="history-card"><div class="label">Private evolution</div><h2>Remember only what changed.</h2><p>Optional history stores aggregate counts in this browser on this Mac. No names, paths, guess, or task details.</p><p class="observer-result" id="history-result">Reveal your footprint, then choose whether to save a baseline.</p><div class="history-actions"><button class="button" id="history-button" type="button">Save private baseline</button><button class="button secondary" id="evolution-share-button" type="button" hidden>Share this chapter</button><button class="button secondary" id="clear-history-button" type="button" hidden>Clear history</button></div></div>
      </div>
    </section>
    <footer><span>Scan stays in memory · ${options.localDeviceLabel ? `${escapeHtml(options.localDeviceLabel)} · ` : ''}<span id="scan-date">${escapeHtml(snapshot.generated_date)}</span> · ${escapeHtml(snapshot.architecture_label)}</span><span>No weights, prompts, commands, config values, or account data</span></footer>
  </main>
  <dialog class="share-dialog" id="share-dialog" aria-labelledby="share-title">
    <div class="share-studio">
      <div class="share-head"><div><div class="label" id="share-kind">Your discovery card</div><h2 id="share-title">AI hiding in plain sight.</h2></div><button class="icon-button" id="close-share" type="button" aria-label="Close share card">×</button></div>
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
    let observing = false;
    let observationResult = null;
    let shareMode = 'discover';
    let evolutionDelta = null;
    const HISTORY_KEY = 'forkit-ai-footprints-private-history-v1';
    function plural(value, singular, pluralValue) { return value === 1 ? singular : (pluralValue || singular + 's'); }
    function currentGuess() { if (!guessInput.value.trim()) return null; const value = Number(guessInput.value); return Number.isSafeInteger(value) && value >= 0 ? value : null; }
    function agentResourceText() {
      if (observationResult) return observationResult.duration_seconds.toFixed(1) + 's task window · ' + metricValue(observationResult.average_cpu_percent) + ' avg CPU · ' + metricValue(observationResult.peak_cpu_percent) + ' peak CPU · ' + metricValue(observationResult.peak_memory_percent) + ' peak memory';
      if (currentSnapshot.agent_cpu_percent === null || currentSnapshot.agent_memory_percent === null) return 'Agent CPU and memory snapshot unavailable';
      return currentSnapshot.agent_cpu_percent.toFixed(1) + '% CPU · ' + currentSnapshot.agent_memory_percent.toFixed(1) + '% memory';
    }
    function metricValue(value) { return value === null ? 'unavailable' : value.toFixed(1) + '%'; }
    function inspiration() {
      const models = currentSnapshot.model_record_count;
      if (models === 0) return { line1:'A clear Mac.', line2:'A deliberate start.', title:'Every AI journey starts somewhere.' };
      if (models <= 3) return { line1:'A small constellation.', line2:'A real beginning.', title:'A few discoveries can change what you build.' };
      if (models <= 9) return { line1:'Your Mac is already', line2:'an AI workshop.', title:'More intelligence was hiding in plain sight.' };
      return { line1:'Not just using AI.', line2:'Building an ecosystem.', title:'Your local AI world is bigger than it looks.' };
    }
    function chapter() {
      if (currentSnapshot.active_agent_product_count > 1) return { name:'AI Orchestrator', copy:'Multiple agent products are active in your local AI system.' };
      if (currentSnapshot.active_agent_product_count === 1) return { name:'Agent Operator', copy:'An AI agent is active in your local workflow.' };
      if (currentSnapshot.online_runtime_count > 0 || currentSnapshot.confirmed_running_model_count > 0) return { name:'AI Builder', copy:'Your Mac is actively running part of a local AI stack.' };
      if (currentSnapshot.model_record_count > 0) return { name:'Local Explorer', copy:'You have started building a visible local model collection.' };
      return { name:'AI Curious', copy:'A clear baseline is still a meaningful place to begin.' };
    }
    function historyEntry() {
      return { saved_at:new Date().toISOString(), model_records:currentSnapshot.model_record_count, loaded_models:currentSnapshot.confirmed_running_model_count, responding_runtimes:currentSnapshot.online_runtime_count, agent_products:currentSnapshot.active_agent_product_count, agent_processes:currentSnapshot.active_agent_process_count, model_storage_bytes:currentSnapshot.model_storage_bytes, chapter:chapter().name };
    }
    function readHistory() {
      try {
        const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        if (!Array.isArray(value)) return [];
        return value.filter((item) => item && typeof item.saved_at === 'string' && Number.isSafeInteger(item.model_records) && Number.isSafeInteger(item.agent_products)).slice(-12);
      } catch { return []; }
    }
    function formatBytes(bytes) {
      if (!bytes) return '0 B';
      const units=['B','KB','MB','GB','TB','PB']; let value=bytes; let unit=0;
      while (unit < units.length - 1 && value >= 1024) { value/=1024; unit+=1; }
      return (value < 10 && unit > 1 ? value.toFixed(2) : value < 100 ? value.toFixed(1) : value.toFixed(0)) + ' ' + units[unit];
    }
    function deltaLine(previous, current) {
      if (!previous) return 'Baseline saved. Your next scan can show what changed.';
      const models = current.model_records - previous.model_records;
      const agents = current.agent_products - previous.agent_products;
      const storage = current.model_storage_bytes - previous.model_storage_bytes;
      const parts = [];
      if (models) parts.push((models > 0 ? '+' : '') + models + ' model ' + plural(Math.abs(models), 'record'));
      if (agents) parts.push((agents > 0 ? '+' : '') + agents + ' agent ' + plural(Math.abs(agents), 'product'));
      if (storage) parts.push((storage > 0 ? '+' : '−') + formatBytes(Math.abs(storage)) + ' model storage');
      return parts.length ? parts.join(' · ') : 'No aggregate change since your previous saved scan.';
    }
    function renderEvolution() {
      const currentChapter = chapter();
      document.getElementById('chapter-name').textContent = revealed ? currentChapter.name : 'Reveal to begin';
      document.getElementById('chapter-copy').textContent = revealed ? currentChapter.copy : 'Your chapter reflects visible local activity, not a score.';
      const history = readHistory();
      document.getElementById('clear-history-button').hidden = history.length === 0;
      document.getElementById('evolution-share-button').hidden = !revealed;
      if (!revealed) return;
      const line = evolutionDelta || (history.length ? deltaLine(history[history.length - 1], historyEntry()) : 'No private history saved yet.');
      document.getElementById('chapter-change').textContent = line;
      document.getElementById('history-result').textContent = history.length ? line + ' · ' + history.length + ' saved ' + plural(history.length, 'scan') + '.' : 'Choose Save private baseline to remember aggregate counts on this Mac.';
      document.getElementById('history-button').textContent = history.length ? 'Save this scan' : 'Save private baseline';
    }
    function switchLane(lane) {
      document.querySelectorAll('.lane-button').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.lane === lane)));
      document.querySelectorAll('.lane-panel').forEach((panel) => { panel.hidden = panel.id !== lane + '-panel'; });
      if (lane === 'evolution') renderEvolution();
    }
    function shareText() {
      const guess = currentGuess();
      const prefix = guess === null ? '' : 'I guessed ' + guess + '. ';
      if (shareMode === 'observe' && observationResult) return 'I observed one AI task on my Mac for ' + observationResult.duration_seconds.toFixed(1) + ' seconds: ' + metricValue(observationResult.average_cpu_percent) + ' average detected-agent CPU, ' + metricValue(observationResult.peak_cpu_percent) + ' peak CPU, and ' + metricValue(observationResult.peak_memory_percent) + ' peak memory. Local measurement; shared-process background activity may be included.';
      if (shareMode === 'evolution') return 'My local AI chapter is ' + chapter().name + '. ' + (evolutionDelta || 'I created a private baseline for what comes next.') + ' Forkit AI Footprints keeps the history on my Mac.';
      return inspiration().title + ' ' + prefix + 'Forkit AI Footprints found ' + currentSnapshot.model_record_count + ' local model ' + plural(currentSnapshot.model_record_count, 'record') + ', ' + currentSnapshot.confirmed_running_model_count + ' loaded, ' + currentSnapshot.online_runtime_count + ' responding ' + plural(currentSnapshot.online_runtime_count, 'runtime') + ', and ' + currentSnapshot.active_agent_product_count + ' active AI agent ' + plural(currentSnapshot.active_agent_product_count, 'product') + ' across ' + currentSnapshot.active_agent_process_count + ' ' + plural(currentSnapshot.active_agent_process_count, 'process', 'processes') + '. Recognized model files use ' + currentSnapshot.model_storage_display + '. ' + agentResourceText() + (observationResult ? ' during my observed task window.' : ' at scan time.') + ' Metadata only; nothing uploaded.';
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
      const message = shareMode === 'observe' && observationResult
        ? { line1:'One task.', line2:'Measured locally.', title:'A real moment in my AI workflow.' }
        : shareMode === 'evolution'
          ? { line1:'My AI chapter:', line2:chapter().name + '.', title:'Local AI grows one chapter at a time.' }
          : inspiration();
      context.clearRect(0, 0, 1200, 630);
      const background = context.createLinearGradient(0, 0, 1200, 630); background.addColorStop(0, '#f8eee1'); background.addColorStop(.48, '#f5f0e6'); background.addColorStop(1, '#d8ecec'); context.fillStyle = background; context.fillRect(0, 0, 1200, 630);
      const glowA = context.createRadialGradient(110, 90, 5, 110, 90, 270); glowA.addColorStop(0, 'rgba(244,147,85,.34)'); glowA.addColorStop(1, 'rgba(244,147,85,0)'); context.fillStyle = glowA; context.fillRect(0, 0, 430, 400);
      const glowB = context.createRadialGradient(1040, 90, 5, 1040, 90, 320); glowB.addColorStop(0, 'rgba(0,129,144,.24)'); glowB.addColorStop(1, 'rgba(0,129,144,0)'); context.fillStyle = glowB; context.fillRect(700, 0, 500, 440);
      context.save(); context.translate(925, 310); context.strokeStyle = 'rgba(0,129,144,.15)'; context.lineWidth = 2;
      for (let ring = 1; ring <= 3; ring += 1) { context.beginPath(); context.arc(0, 0, ring * 76, 0, Math.PI * 2); context.stroke(); }
      const nodeCount = Math.max(3, Math.min(18, actual + currentSnapshot.online_runtime_count + currentSnapshot.active_agent_product_count));
      for (let index = 0; index < nodeCount; index += 1) { const angle = (Math.PI * 2 * index / nodeCount) - Math.PI / 2; const radius = 76 + (index % 3) * 76; const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius; context.beginPath(); context.arc(x, y, index % 3 === 0 ? 11 : 7, 0, Math.PI * 2); context.fillStyle = index % 3 === 0 ? '#f49355' : '#008190'; context.fill(); }
      context.beginPath(); context.arc(0, 0, 53, 0, Math.PI * 2); context.fillStyle = '#fffefa'; context.fill(); context.strokeStyle = 'rgba(45,43,39,.10)'; context.stroke(); context.fillStyle = '#292824'; context.font = '800 33px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.textAlign = 'center'; context.fillText(String(actual), 0, 12); context.restore();
      context.textAlign = 'left'; context.fillStyle = '#008190'; context.font = '800 19px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText('FORKIT AI FOOTPRINTS  ·  ' + shareMode.toUpperCase(), 64, 61);
      context.fillStyle = '#292824'; context.font = '800 55px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(message.line1, 64, 145); context.fillText(message.line2, 64, 205);
      context.fillStyle = '#6d6961'; context.font = '600 20px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(actual + ' model ' + plural(actual, 'record') + ' · ' + currentSnapshot.active_agent_product_count + ' active ' + plural(currentSnapshot.active_agent_product_count, 'agent') + ' · ' + currentSnapshot.model_storage_display + ' on disk', 64, 249);
      roundedRect(context, 64, 285, 510, 137, 25); context.fillStyle = 'rgba(255,254,250,.76)'; context.fill(); context.strokeStyle = 'rgba(45,43,39,.10)'; context.stroke();
      context.fillStyle = '#6d6961'; context.font = '800 16px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText('MY GUESS', 91, 320); context.fillText('DISCOVERED', 322, 320);
      context.fillStyle = '#292824'; context.font = '800 68px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(String(guess), 91, 387); context.fillStyle = '#008190'; context.fillText('→  ' + actual, 235, 387);
      context.fillStyle = difference === 0 ? '#2d987b' : '#a9582d'; context.font = '750 16px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(difference === 0 ? 'Exactly right.' : Math.abs(difference) + (difference > 0 ? ' more than I expected.' : ' fewer than I expected.'), 91, 410);
      const cards = [[String(actual), 'MODEL RECORDS'], [String(currentSnapshot.confirmed_running_model_count), 'LOADED MODEL' + (currentSnapshot.confirmed_running_model_count === 1 ? '' : 'S')], [String(currentSnapshot.active_agent_process_count), 'AGENT PROCESS' + (currentSnapshot.active_agent_process_count === 1 ? '' : 'ES')], [currentSnapshot.model_storage_display, 'MODEL DISK USE']];
      cards.forEach((card, index) => { const x = 64 + index * 263; roundedRect(context, x, 453, 244, 91, 19); context.fillStyle = index % 2 === 0 ? 'rgba(255,254,250,.78)' : 'rgba(220,236,239,.72)'; context.fill(); context.strokeStyle = 'rgba(45,43,39,.10)'; context.stroke(); context.fillStyle = '#292824'; context.font = '800 29px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(card[0], x + 18, 493); context.fillStyle = '#6d6961'; context.font = '800 12px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(card[1], x + 18, 522); });
      context.fillStyle = '#292824'; context.font = '800 15px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(chapter().name.toUpperCase(), 64, 588);
      context.fillStyle = '#6d6961'; context.font = '600 13px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'; context.fillText(agentResourceText() + '  ·  Metadata only  ·  Nothing uploaded', 290, 588);
    }
    function canvasBlob() { return new Promise((resolve) => shareCanvas.toBlob(resolve, 'image/png')); }
    async function openShareStudio(mode) { shareMode = mode || 'discover'; drawShareCard(); document.getElementById('share-kind').textContent = 'Your ' + shareMode + ' card'; document.getElementById('share-title').textContent = shareMode === 'observe' ? 'A real moment in my AI workflow.' : shareMode === 'evolution' ? 'Local AI grows one chapter at a time.' : inspiration().title; document.body.classList.add('dialog-open'); shareDialog.showModal(); }
    function closeShareStudio() { shareDialog.close(); document.body.classList.remove('dialog-open'); }
    function renderActual() {
      revealed = true;
      document.getElementById('model-value').textContent = String(currentSnapshot.model_record_count);
      document.getElementById('runtime-value').textContent = String(currentSnapshot.online_runtime_count);
      document.getElementById('loaded-model-value').textContent = String(currentSnapshot.confirmed_running_model_count);
      document.getElementById('agent-value').textContent = String(currentSnapshot.active_agent_product_count);
      document.getElementById('agent-process-value').textContent = String(currentSnapshot.active_agent_process_count);
      document.getElementById('storage-value').textContent = currentSnapshot.model_storage_display;
      document.getElementById('storage-note').textContent = currentSnapshot.model_storage_bytes.toLocaleString() + ' recognized logical bytes · ' + (currentSnapshot.model_storage_complete ? 'complete supported-root scan' : 'incomplete scan') + ' · no model contents read.';
      document.getElementById('agent-resource-value').textContent = agentResourceText() + ' · point in time.';
      document.getElementById('scan-date').textContent = currentSnapshot.generated_date;
      document.getElementById('summary').innerHTML = '<strong>' + inspiration().title + '</strong><br>' + currentSnapshot.model_record_count + ' model ' + plural(currentSnapshot.model_record_count, 'record') + ' · ' + currentSnapshot.confirmed_running_model_count + ' loaded · ' + currentSnapshot.active_agent_product_count + ' active ' + plural(currentSnapshot.active_agent_product_count, 'agent') + ' · ' + currentSnapshot.model_storage_display + ' on disk.';
      document.getElementById('result-actions').hidden = false;
      renderEvolution();
    }
    async function startLiveFeed() {
      if (!rescanConfig) return;
      try {
        const response = await fetch(rescanConfig.live_endpoint, { method:'POST', headers:{ 'accept':'application/x-ndjson', 'x-forkit-footprints-session':rescanConfig.session_token } });
        if (!response.ok || !response.body) throw new Error('LIVE_UNAVAILABLE');
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = '';
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break; pending += decoder.decode(chunk.value, { stream:true });
          const lines = pending.split('\n'); pending = lines.pop() || '';
          for (const line of lines) {
            if (!line) continue; const live = JSON.parse(line);
            currentSnapshot.online_runtime_count = live.online_runtime_count;
            currentSnapshot.confirmed_running_model_count = live.confirmed_running_model_count;
            currentSnapshot.active_agent_product_count = live.active_agent_product_count;
            currentSnapshot.active_agent_process_count = live.active_agent_process_count;
            currentSnapshot.agent_cpu_percent = live.agent_cpu_percent;
            currentSnapshot.agent_memory_percent = live.agent_memory_percent;
            if (revealed) renderActual();
            document.getElementById('live-note').textContent = 'Near-real-time local evidence · ' + live.scan_latency_ms + ' ms scan · no external network.';
          }
        }
      } catch { document.getElementById('live-note').textContent = 'Live view unavailable; Scan again remains available.'; }
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
    document.querySelectorAll('.lane-button').forEach((button) => button.addEventListener('click', () => switchLane(button.dataset.lane)));
    document.getElementById('share-button').addEventListener('click', () => openShareStudio('discover'));
    document.getElementById('evolution-share-button').addEventListener('click', () => openShareStudio('evolution'));
    document.getElementById('history-button').addEventListener('click', () => {
      if (!revealed) { switchLane('discover'); document.getElementById('guess-input').focus(); return; }
      const history = readHistory();
      const current = historyEntry();
      const previous = history[history.length - 1] || null;
      evolutionDelta = deltaLine(previous, current);
      localStorage.setItem(HISTORY_KEY, JSON.stringify([...history, current].slice(-12)));
      renderEvolution();
    });
    document.getElementById('clear-history-button').addEventListener('click', () => {
      if (!window.confirm('Clear private AI Footprints history from this browser?')) return;
      localStorage.removeItem(HISTORY_KEY); evolutionDelta = null; renderEvolution();
    });
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
    if (rescanConfig) document.getElementById('observe-button').addEventListener('click', async () => {
      const button = document.getElementById('observe-button');
      button.disabled = true;
      const endpoint = observing ? rescanConfig.observe_stop_endpoint : rescanConfig.observe_start_endpoint;
      try {
        const response = await fetch(endpoint, { method:'POST', headers:{ 'accept':'application/json', 'x-forkit-footprints-session':rescanConfig.session_token } });
        if (!response.ok) throw new Error('OBSERVATION_FAILED');
        if (!observing) {
          observing = true;
          observationResult = null;
          button.textContent = 'Stop & measure';
          document.getElementById('observer-result').textContent = 'Observing now. Perform one AI task, then stop.';
          status.textContent = 'Task observation stays in memory on this Mac.';
        } else {
          observing = false;
          observationResult = await response.json();
          button.textContent = 'Observe another task';
          document.getElementById('observer-result').textContent = agentResourceText() + ' · ' + observationResult.sample_count + ' samples.';
          document.getElementById('agent-resource-value').textContent = agentResourceText();
          document.getElementById('observe-share-button').hidden = false;
          status.textContent = 'Task window measured locally. Shared-process background activity may be included.';
        }
      } catch {
        status.textContent = 'Task observation could not complete. No result was saved.';
      } finally { button.disabled = false; }
    });
    if (rescanConfig) document.getElementById('observe-share-button').addEventListener('click', () => openShareStudio('observe'));
    if (rescanConfig) document.getElementById('stop-button').addEventListener('click', async () => {
      const button = document.getElementById('stop-button'); button.disabled = true; button.textContent = 'Closing…';
      try {
        const response = await fetch(rescanConfig.stop_endpoint, { method:'POST', headers:{ 'accept':'application/json', 'x-forkit-footprints-session':rescanConfig.session_token } });
        if (!response.ok) throw new Error('STOP_FAILED');
        document.body.innerHTML = '<main class="shell"><section class="guess-card"><div class="label">Forkit AI Footprints</div><h1 style="font-size:48px;line-height:1;margin-top:18px">Local scan closed.</h1><p class="summary">The private service has stopped. You can close this tab.</p></section></main>';
      } catch { button.disabled = false; button.textContent = 'Close local scan'; status.textContent = 'The local service is still running.'; }
    });
    if (rescanConfig) void startLiveFeed();
  </script>
</body>
</html>`;
}
