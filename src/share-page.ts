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

export function renderCensusSharePage(report: CensusReport): string {
  const snapshot = buildCensusShareSnapshot(report);
  const shareText = [
    `My Mac has ${snapshot.model_record_count} local AI model ${plural(snapshot.model_record_count, 'record')},`,
    `${snapshot.online_runtime_count} active ${plural(snapshot.online_runtime_count, 'runtime')}, and`,
    `${snapshot.active_agent_product_count} active AI agent ${plural(snapshot.active_agent_product_count, 'product')}.`,
    `Discovered locally with Forkit Census — ${snapshot.storage_bucket} model storage, no data uploaded.`,
  ].join(' ');
  const safeShareText = JSON.stringify(shareText).replaceAll('<', '\\u003c');
  const highConfidenceLabel = snapshot.active_agent_product_count > 0
    && snapshot.high_confidence_agent_count === snapshot.active_agent_product_count
    ? 'High-confidence evidence'
    : 'Reviewable evidence';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Your AI footprint · Forkit Census</title>
  <style>
    :root {
      --bg: #f5f0e6;
      --paper: #fffefa;
      --ink: #2d2b27;
      --muted: #6d6961;
      --line: rgba(45, 43, 39, .12);
      --teal: #008190;
      --teal-soft: #dcecef;
      --orange: #f49355;
      --orange-soft: #fbe6d7;
      --success: #2d987b;
      --shadow: 0 28px 80px rgba(45, 43, 39, .10), 0 8px 28px rgba(45, 43, 39, .06);
    }
    * { box-sizing: border-box; }
    html { background: var(--bg); }
    body {
      margin: 0;
      min-width: 320px;
      color: var(--ink);
      background:
        radial-gradient(circle at 7% 4%, rgba(244,147,85,.17), transparent 27rem),
        radial-gradient(circle at 92% 8%, rgba(0,129,144,.13), transparent 30rem),
        var(--bg);
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    button { font: inherit; }
    .shell { width: min(1180px, calc(100% - 40px)); margin: 0 auto; padding: 28px 0 48px; }
    .nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 54px; }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 760; letter-spacing: -.03em; }
    .brand-mark {
      width: 38px; height: 38px; border-radius: 12px; position: relative; overflow: hidden;
      background: linear-gradient(145deg, var(--teal), #6aa7ab 52%, var(--orange));
      box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 8px 20px rgba(0,129,144,.18);
    }
    .brand-mark::before, .brand-mark::after { content: ""; position: absolute; background: #fffefa; border-radius: 99px; }
    .brand-mark::before { width: 20px; height: 5px; left: 9px; top: 10px; transform: rotate(-8deg); }
    .brand-mark::after { width: 5px; height: 20px; left: 12px; top: 9px; transform: rotate(8deg); }
    .brand small { display: block; margin-top: 2px; color: var(--muted); font-size: 10px; letter-spacing: .18em; text-transform: uppercase; font-weight: 650; }
    .private-pill, .scan-pill { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line); background: rgba(255,254,250,.62); backdrop-filter: blur(16px); }
    .private-pill { border-radius: 999px; padding: 9px 13px; color: #4e4a44; font-size: 12px; font-weight: 680; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 5px rgba(45,152,123,.10); }
    .hero { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(350px, .88fr); gap: 48px; align-items: end; margin-bottom: 34px; }
    .eyebrow { color: var(--teal); text-transform: uppercase; letter-spacing: .20em; font-size: 11px; font-weight: 780; margin: 0 0 16px; }
    h1 { margin: 0; max-width: 760px; font-size: clamp(52px, 6vw, 88px); line-height: .91; letter-spacing: -.065em; font-weight: 760; }
    .hero-copy { margin: 24px 0 0; max-width: 650px; color: var(--muted); font-size: 17px; line-height: 1.65; }
    .hero-copy strong { color: var(--ink); font-weight: 680; }
    .share-panel { border: 1px solid rgba(255,255,255,.66); border-radius: 28px; padding: 24px; background: rgba(255,254,250,.68); box-shadow: var(--shadow); backdrop-filter: blur(24px); }
    .scan-pill { width: fit-content; border-radius: 999px; padding: 8px 11px; color: var(--teal); font-size: 11px; font-weight: 760; letter-spacing: .08em; text-transform: uppercase; }
    .share-panel h2 { margin: 20px 0 8px; font-size: 25px; letter-spacing: -.04em; }
    .share-panel p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.65; }
    .actions { display: flex; gap: 10px; margin-top: 22px; }
    .button { min-height: 44px; border-radius: 13px; padding: 0 17px; border: 1px solid var(--line); font-weight: 720; cursor: pointer; transition: transform .15s ease, box-shadow .15s ease; }
    .button:hover { transform: translateY(-1px); }
    .button.primary { color: #fffefa; border-color: var(--teal); background: var(--teal); box-shadow: 0 10px 24px rgba(0,129,144,.20); }
    .button.secondary { color: var(--ink); background: #eee8df; }
    .action-status { min-height: 18px; margin-top: 10px; color: var(--success); font-size: 12px; font-weight: 650; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 14px; }
    .metric { min-height: 192px; border: 1px solid var(--line); border-radius: 24px; padding: 23px; background: rgba(255,254,250,.76); box-shadow: 0 15px 35px rgba(45,43,39,.045); }
    .metric:nth-child(2) { background: linear-gradient(145deg, rgba(220,236,239,.92), rgba(255,254,250,.85)); }
    .metric:nth-child(3) { background: linear-gradient(145deg, rgba(251,230,215,.92), rgba(255,254,250,.85)); }
    .metric-label { min-height: 34px; color: var(--muted); font-size: 12px; line-height: 1.4; font-weight: 720; letter-spacing: .08em; text-transform: uppercase; }
    .metric-value { margin: 18px 0 7px; font-size: 52px; line-height: 1; letter-spacing: -.055em; font-weight: 760; }
    .metric-value.storage { font-size: 35px; margin-top: 27px; }
    .metric-note { color: var(--muted); font-size: 12px; line-height: 1.55; }
    .details { display: grid; grid-template-columns: 1.15fr .85fr; gap: 14px; }
    .card { border: 1px solid var(--line); border-radius: 24px; background: rgba(255,254,250,.72); padding: 25px; }
    .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .card h3 { margin: 0; font-size: 18px; letter-spacing: -.03em; }
    .subtle { color: var(--muted); font-size: 11px; font-weight: 650; }
    .signal-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .signal { display: flex; gap: 13px; align-items: center; border-radius: 16px; background: rgba(45,43,39,.035); padding: 14px; }
    .signal-icon { width: 38px; height: 38px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 12px; color: var(--teal); background: var(--teal-soft); font-size: 14px; font-weight: 800; }
    .signal:nth-child(2) .signal-icon, .signal:nth-child(4) .signal-icon { color: #aa5b2c; background: var(--orange-soft); }
    .signal strong { display: block; font-size: 14px; }
    .signal span { display: block; margin-top: 3px; color: var(--muted); font-size: 11px; line-height: 1.4; }
    .evidence { display: grid; gap: 12px; }
    .evidence-row { display: grid; grid-template-columns: 1fr auto; gap: 18px; align-items: center; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
    .evidence-row:last-child { border: 0; padding-bottom: 0; }
    .evidence-row strong { display: block; font-size: 13px; }
    .evidence-row span { display: block; color: var(--muted); font-size: 11px; margin-top: 4px; }
    .evidence-badge { border-radius: 999px; padding: 7px 10px; background: #edf5f1; color: #23765f; font-size: 10px; font-weight: 780; white-space: nowrap; }
    .evidence-badge.caution { color: #9b572e; background: #fbebdf; }
    .foot { display: flex; justify-content: space-between; gap: 28px; margin-top: 16px; padding: 18px 4px 0; color: var(--muted); font-size: 10px; line-height: 1.55; }
    .foot strong { color: var(--ink); }
    @media (max-width: 900px) {
      .hero { grid-template-columns: 1fr; align-items: start; }
      .metrics { grid-template-columns: repeat(2, 1fr); }
      .details { grid-template-columns: 1fr; }
    }
    @media (max-width: 560px) {
      .shell { width: min(100% - 24px, 1180px); padding-top: 16px; }
      .nav { margin-bottom: 38px; }
      .private-pill { font-size: 0; padding: 11px; }
      .hero { gap: 28px; }
      h1 { font-size: 50px; }
      .metrics { grid-template-columns: 1fr; }
      .metric { min-height: 160px; }
      .signal-grid { grid-template-columns: 1fr; }
      .actions { flex-direction: column; }
      .foot { flex-direction: column; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <nav class="nav" aria-label="Census result header">
      <div class="brand"><span class="brand-mark" aria-hidden="true"></span><span>Forkit Census<small>Local AI inventory</small></span></div>
      <div class="private-pill"><span class="dot" aria-hidden="true"></span>Private by default · zero uploads</div>
    </nav>

    <section class="hero">
      <div>
        <p class="eyebrow">Your local AI snapshot</p>
        <h1>Your AI footprint,<br>discovered locally.</h1>
        <p class="hero-copy">A metadata-only look at what is actually present on this Mac. <strong>No login. No cloud scan. No registry writes.</strong></p>
      </div>
      <aside class="share-panel" aria-label="Share this snapshot">
        <div class="scan-pill"><span class="dot" aria-hidden="true"></span> Live local result</div>
        <h2>Make your AI use visible.</h2>
        <p>Share only these aggregate counts. Model names, paths, commands, configuration values, and account identity stay off the card.</p>
        <div class="actions">
          <button class="button primary" id="share-button" type="button">Share snapshot</button>
          <button class="button secondary" id="copy-button" type="button">Copy summary</button>
        </div>
        <div class="action-status" id="action-status" role="status" aria-live="polite"></div>
      </aside>
    </section>

    <section class="metrics" aria-label="AI footprint metrics">
      <article class="metric">
        <div class="metric-label">Model records</div>
        <div class="metric-value">${escapeHtml(snapshot.model_record_count)}</div>
        <div class="metric-note">Metadata discoveries; one model may have more than one evidence source.</div>
      </article>
      <article class="metric">
        <div class="metric-label">Active runtimes</div>
        <div class="metric-value">${escapeHtml(snapshot.online_runtime_count)}</div>
        <div class="metric-note">Runtime APIs responding on this Mac through loopback only.</div>
      </article>
      <article class="metric">
        <div class="metric-label">Active agent products</div>
        <div class="metric-value">${escapeHtml(snapshot.active_agent_product_count)}</div>
        <div class="metric-note">${escapeHtml(highConfidenceLabel)} from explicit running-process evidence.</div>
      </article>
      <article class="metric">
        <div class="metric-label">Discovered model storage</div>
        <div class="metric-value storage">${escapeHtml(snapshot.storage_bucket)}</div>
        <div class="metric-note">Best-effort local file metadata, shown as a privacy-safe range.</div>
      </article>
    </section>

    <section class="details">
      <article class="card">
        <div class="card-head"><h3>Your setup at a glance</h3><span class="subtle">This Mac · ${escapeHtml(snapshot.architecture_label)}</span></div>
        <div class="signal-grid">
          <div class="signal"><div class="signal-icon">AI</div><div><strong>${escapeHtml(snapshot.tool_count)} AI ${plural(snapshot.tool_count, 'tool')} found</strong><span>Installed, configured, or active evidence</span></div></div>
          <div class="signal"><div class="signal-icon">MCP</div><div><strong>${escapeHtml(snapshot.mcp_config_count)} MCP ${plural(snapshot.mcp_config_count, 'config')}</strong><span>Counts only; server values are never shown</span></div></div>
          <div class="signal"><div class="signal-icon">RUN</div><div><strong>${escapeHtml(snapshot.confirmed_running_model_count)} ${plural(snapshot.confirmed_running_model_count, 'model')} loaded now</strong><span>Direct confirmed-running evidence when available</span></div></div>
          <div class="signal"><div class="signal-icon">PROC</div><div><strong>${escapeHtml(snapshot.agent_process_instance_count)} process ${plural(snapshot.agent_process_instance_count, 'instance')}</strong><span>Supporting processes, not independent agents</span></div></div>
        </div>
      </article>

      <article class="card">
        <div class="card-head"><h3>What makes this credible</h3><span class="subtle">v${escapeHtml(snapshot.product_version)}</span></div>
        <div class="evidence">
          <div class="evidence-row"><div><strong>Network boundary</strong><span>Only local loopback runtime checks</span></div><div class="evidence-badge">${escapeHtml(snapshot.external_request_count)} external</div></div>
          <div class="evidence-row"><div><strong>Agent evidence</strong><span>Exact executable or explicit invocation</span></div><div class="evidence-badge">Reviewable</div></div>
          <div class="evidence-row"><div><strong>Model filesystem</strong><span>Metadata only; model bytes are not read</span></div><div class="evidence-badge caution">Best effort</div></div>
          <div class="evidence-row"><div><strong>Coverage notes</strong><span>Known limitations remain visible</span></div><div class="evidence-badge caution">${escapeHtml(snapshot.warning_count)} notes</div></div>
        </div>
      </article>
    </section>

    <footer class="foot">
      <span><strong>Scanned ${escapeHtml(snapshot.generated_date)}</strong> · macOS ${escapeHtml(snapshot.architecture)} · Node ${escapeHtml(snapshot.node_major)}</span>
      <span>Inventory suggestions are not proof of ownership, safety, provenance, or passport status.</span>
    </footer>
  </main>
  <script>
    const shareText = ${safeShareText};
    const status = document.getElementById('action-status');
    async function copySummary() {
      try {
        await navigator.clipboard.writeText(shareText);
      } catch {
        const area = document.createElement('textarea');
        area.value = shareText;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      status.textContent = 'Aggregate summary copied — no private item names included.';
    }
    document.getElementById('copy-button').addEventListener('click', copySummary);
    document.getElementById('share-button').addEventListener('click', async () => {
      if (navigator.share) {
        try {
          await navigator.share({ title: 'My AI footprint · Forkit Census', text: shareText });
          status.textContent = 'Shared through your device — Forkit received nothing.';
          return;
        } catch (error) {
          if (error && error.name === 'AbortError') return;
        }
      }
      await copySummary();
    });
  </script>
</body>
</html>`;
}
