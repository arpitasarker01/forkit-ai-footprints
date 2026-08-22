import type { CensusReport } from './types';

export interface CensusShareSnapshot {
  generated_date: string;
  architecture_label: string;
  model_record_count: number;
  online_runtime_count: number;
  active_agent_product_count: number;
  storage_bucket: string;
  external_request_count: 0;
}

export interface GlobalAiFootprintPulse {
  participating_devices: number;
  model_records: number;
  active_agent_products: number;
  updated_at: string;
  source: 'consented-aggregate';
}

export interface LocalRescanOptions {
  endpoint: string;
  session_token: string;
}

export interface AiFootprintPageOptions {
  globalPulse?: GlobalAiFootprintPulse;
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

function validateRescanOptions(rescan: LocalRescanOptions): void {
  if (!rescan.endpoint.startsWith('/') || rescan.endpoint.startsWith('//') || !/^[a-f0-9]{48}$/.test(rescan.session_token)) {
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
    storage_bucket: report.summary.storage_bucket.replace('-', '–'),
    external_request_count: report.privacy.external_requests_made,
  };
}

export function renderCensusSharePage(report: CensusReport, options: AiFootprintPageOptions = {}): string {
  const snapshot = buildCensusShareSnapshot(report);
  const pulse = options.globalPulse;
  const rescan = options.rescan;
  if (pulse) validateGlobalPulse(pulse);
  if (rescan) validateRescanOptions(rescan);
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
    :root { --bg:#f5f0e6; --paper:rgba(255,254,250,.78); --ink:#292824; --muted:#6d6961; --line:rgba(45,43,39,.12); --teal:#008190; --orange:#f49355; --green:#2d987b; --shadow:0 24px 70px rgba(45,43,39,.09); }
    * { box-sizing:border-box; }
    html { background:var(--bg); }
    body { margin:0; min-width:320px; color:var(--ink); background:radial-gradient(circle at 0 0,rgba(244,147,85,.18),transparent 29rem),radial-gradient(circle at 100% 0,rgba(0,129,144,.15),transparent 31rem),var(--bg); font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; -webkit-font-smoothing:antialiased; }
    button,input { font:inherit; }
    [hidden] { display:none !important; }
    .shell { width:min(1040px,calc(100% - 40px)); margin:0 auto; padding:26px 0 34px; }
    .nav { display:flex; justify-content:space-between; align-items:center; margin-bottom:46px; }
    .brand { display:flex; align-items:center; gap:11px; font-size:16px; font-weight:780; letter-spacing:-.03em; }
    .mark { width:34px; height:34px; border-radius:11px; background:linear-gradient(145deg,var(--teal),#6aa7ab 54%,var(--orange)); box-shadow:0 8px 20px rgba(0,129,144,.18); }
    .private { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:12px; font-weight:680; }
    .dot { width:8px; height:8px; border-radius:50%; background:var(--green); box-shadow:0 0 0 5px rgba(45,152,123,.10); }
    .hero { display:grid; grid-template-columns:minmax(0,1.12fr) minmax(330px,.88fr); gap:30px; align-items:end; margin-bottom:18px; }
    .eyebrow { margin:0 0 13px; color:var(--teal); font-size:11px; font-weight:800; letter-spacing:.19em; text-transform:uppercase; }
    h1 { margin:0; max-width:650px; font-size:clamp(58px,7.6vw,88px); line-height:.89; letter-spacing:-.07em; }
    .summary { margin:20px 0 0; color:var(--muted); font-size:15px; }
    .guess-card,.metric,.global,.install { border:1px solid var(--line); background:var(--paper); backdrop-filter:blur(20px); box-shadow:var(--shadow); }
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
    .metrics { display:grid; grid-template-columns:repeat(3,1fr); gap:13px; }
    .metric { min-height:145px; padding:21px; border-radius:22px; }
    .metric:nth-child(2) { background:linear-gradient(145deg,rgba(220,236,239,.94),var(--paper)); }
    .metric:nth-child(3) { background:linear-gradient(145deg,rgba(251,230,215,.94),var(--paper)); }
    .value { margin:17px 0 7px; font-size:46px; line-height:.92; font-weight:780; letter-spacing:-.055em; }
    .value.combo { font-size:27px; line-height:1.08; }
    .note { color:var(--muted); font-size:11px; line-height:1.45; }
    .global { display:grid; grid-template-columns:1fr 1.45fr; gap:30px; align-items:center; margin-top:13px; padding:21px; border-radius:22px; }
    .global h2 { margin:6px 0; font-size:23px; letter-spacing:-.045em; }
    .global p { margin:0; color:var(--muted); font-size:11px; }
    .pulse-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:9px; }
    .pulse { padding:12px; border-radius:14px; background:rgba(45,43,39,.035); }
    .pulse strong { display:block; font-size:22px; letter-spacing:-.04em; }
    .pulse span { display:block; margin-top:4px; color:var(--muted); font-size:8px; text-transform:uppercase; letter-spacing:.08em; }
    .install { display:grid; grid-template-columns:.72fr 1.28fr; gap:22px; align-items:center; margin-top:13px; padding:18px 21px; border-radius:22px; }
    .install h2 { margin:5px 0 4px; font-size:19px; letter-spacing:-.035em; }
    .install p { margin:0; color:var(--muted); font-size:10px; line-height:1.45; }
    .command { position:relative; padding:13px 48px 13px 15px; border-radius:13px; color:#f8f5ed; background:#292824; font:11px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace; white-space:pre-wrap; }
    .copy-install { position:absolute; top:9px; right:9px; min-height:29px; padding:0 9px; border:1px solid rgba(255,255,255,.2); border-radius:8px; color:#fff; background:rgba(255,255,255,.08); font-size:10px; cursor:pointer; }
    footer { display:flex; justify-content:space-between; gap:20px; padding:15px 3px 0; color:var(--muted); font-size:9px; line-height:1.5; }
    @media (max-width:760px) { .nav{margin-bottom:38px}.hero{grid-template-columns:1fr;align-items:start}.metrics{grid-template-columns:1fr}.metric{min-height:130px}.global,.install{grid-template-columns:1fr} }
    @media (max-width:440px) { .shell{width:calc(100% - 24px);padding-top:16px}.private{font-size:0}h1{font-size:58px}.guess-row{grid-template-columns:1fr}.actions{flex-direction:column}.pulse-grid{grid-template-columns:1fr}footer{flex-direction:column} }
  </style>
</head>
<body>
  <main class="shell">
    <nav class="nav" aria-label="AI Footprints result header">
      <div class="brand"><span class="mark" aria-hidden="true"></span>Forkit AI Footprints</div>
      <div class="private"><span class="dot" aria-hidden="true"></span>Metadata only · stays on this device</div>
    </nav>
    <section class="hero">
      <div><p class="eyebrow">Your Mac · private local scan</p><h1>Guess.<br>Then know.</h1><p class="summary" id="summary">Guess first. See what is actually here.</p></div>
      <aside class="guess-card" aria-label="Guess your local model count">
        <div class="label">Your guess</div><h2 class="guess-title">How many local AI models?</h2>
        <div class="guess-row"><input class="guess-input" id="guess-input" type="number" inputmode="numeric" min="0" max="100000" step="1" placeholder="e.g. 5" aria-label="Guessed local AI model count"><button class="button" id="reveal-button" type="button">Reveal actual</button></div>
        <p class="guess-result" id="guess-result">Your guess never leaves this page.</p>
        <div class="actions" id="result-actions" hidden><button class="button" id="share-button" type="button">Share result</button>${rescan ? '<button class="button secondary" id="scan-button" type="button">Scan again</button>' : ''}</div>
        <div class="status" id="action-status" role="status" aria-live="polite"></div>
      </aside>
    </section>
    <section class="metrics" aria-label="Local AI footprint" aria-live="polite">
      <article class="metric"><div class="label">Model records</div><div class="value" id="model-value">?</div><div class="note">Metadata evidence, not ownership.</div></article>
      <article class="metric"><div class="label">AI active now</div><div class="value combo"><span id="runtime-value">?</span> runtime<br><span id="agent-value">?</span> agent</div><div class="note">Responding runtime and active product evidence.</div></article>
      <article class="metric"><div class="label">Local model storage</div><div class="value combo" id="storage-value">?</div><div class="note">Privacy-safe estimated range.</div></article>
    </section>
    <section class="global" aria-label="Global AI Footprints pulse">
      <div><div class="label">Global AI Pulse · ${escapeHtml(pulseState)}</div><h2>The world's local AI, counted live.</h2><p>${escapeHtml(pulseUpdated)}</p></div>
      <div class="pulse-grid"><div class="pulse"><strong>${escapeHtml(formatGlobalValue(pulse?.participating_devices))}</strong><span>Participating devices</span></div><div class="pulse"><strong>${escapeHtml(formatGlobalValue(pulse?.model_records))}</strong><span>Model records</span></div><div class="pulse"><strong>${escapeHtml(formatGlobalValue(pulse?.active_agent_products))}</strong><span>Active agent findings</span></div></div>
    </section>
    <section class="install" aria-label="Install Forkit AI Footprints">
      <div><div class="label">Same pattern as Forkit Connect</div><h2>Install once. Scan locally.</h2><p>Prepared npm command; it becomes public only after package approval and publication.</p></div>
      <div class="command" id="install-command">npm install -g forkit-ai-footprints
forkit-ai-footprints serve<button class="copy-install" id="copy-install" type="button">Copy</button></div>
    </section>
    <footer><span>Scan stays in memory · <span id="scan-date">${escapeHtml(snapshot.generated_date)}</span> · ${escapeHtml(snapshot.architecture_label)}</span><span>No weights, prompts, commands, config values, or account data</span></footer>
  </main>
  <script>
    let currentSnapshot = ${safeScriptJson(snapshot)};
    const rescanConfig = ${safeScriptJson(rescan ?? null)};
    const status = document.getElementById('action-status');
    const guessInput = document.getElementById('guess-input');
    let revealed = false;
    function plural(value, singular, pluralValue) { return value === 1 ? singular : (pluralValue || singular + 's'); }
    function currentGuess() { const value = Number(guessInput.value); return Number.isSafeInteger(value) && value >= 0 ? value : null; }
    function shareText() {
      const guess = currentGuess();
      const prefix = guess === null ? '' : 'I guessed ' + guess + '. ';
      return prefix + 'Forkit AI Footprints found ' + currentSnapshot.model_record_count + ' local AI model ' + plural(currentSnapshot.model_record_count, 'record') + ', ' + currentSnapshot.online_runtime_count + ' active ' + plural(currentSnapshot.online_runtime_count, 'runtime') + ', and ' + currentSnapshot.active_agent_product_count + ' active AI agent ' + plural(currentSnapshot.active_agent_product_count, 'product') + ' on my Mac. ' + currentSnapshot.storage_bucket + ' model storage. Metadata only; nothing uploaded.';
    }
    function renderActual() {
      revealed = true;
      document.getElementById('model-value').textContent = String(currentSnapshot.model_record_count);
      document.getElementById('runtime-value').textContent = String(currentSnapshot.online_runtime_count);
      document.getElementById('agent-value').textContent = String(currentSnapshot.active_agent_product_count);
      document.getElementById('storage-value').textContent = currentSnapshot.storage_bucket;
      document.getElementById('scan-date').textContent = currentSnapshot.generated_date;
      document.getElementById('summary').innerHTML = '<strong>' + currentSnapshot.model_record_count + ' model ' + plural(currentSnapshot.model_record_count, 'record') + ' · ' + currentSnapshot.online_runtime_count + ' ' + plural(currentSnapshot.online_runtime_count, 'runtime') + ' · ' + currentSnapshot.active_agent_product_count + ' ' + plural(currentSnapshot.active_agent_product_count, 'agent') + '</strong> · nothing uploaded.';
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
    document.getElementById('share-button').addEventListener('click', async () => {
      const text = shareText();
      if (navigator.share) { try { await navigator.share({ title:'My AI Footprint · Forkit', text }); status.textContent='Shared privately through your device.'; return; } catch (error) { if (error && error.name === 'AbortError') return; } }
      await copyText(text); status.textContent='Result copied — no private item names included.';
    });
    if (rescanConfig) document.getElementById('scan-button').addEventListener('click', async () => {
      const button = document.getElementById('scan-button'); button.disabled = true; button.textContent = 'Scanning…'; status.textContent = 'Reading local metadata again…';
      try {
        const response = await fetch(rescanConfig.endpoint, { method:'POST', headers:{ 'accept':'application/json', 'x-forkit-footprints-session':rescanConfig.session_token } });
        if (!response.ok) throw new Error('SCAN_FAILED');
        currentSnapshot = await response.json(); renderActual(); compareGuess(); status.textContent = 'Fresh local scan complete. Nothing was uploaded.';
      } catch { status.textContent = 'Scan could not complete. Your previous local result is unchanged.'; }
      finally { button.disabled = false; button.textContent = 'Scan again'; }
    });
    document.getElementById('copy-install').addEventListener('click', async () => { await copyText('npm install -g forkit-ai-footprints\\nforkit-ai-footprints serve'); document.getElementById('copy-install').textContent='Copied'; });
  </script>
</body>
</html>`;
}
