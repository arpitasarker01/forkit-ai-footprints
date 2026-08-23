import fs from 'node:fs';
import path from 'node:path';
import type { CensusReport } from './types';

export interface CensusShareSnapshot {
  generated_date: string;
  architecture_label: string;
  model_record_count: number;
  verified_runtime_count: number;
  detected_agent_product_count: number;
  detected_agent_process_count: number;
  confirmed_running_model_count: number;
  model_storage_bytes: number;
  model_storage_decimal_display: string;
  model_storage_binary_display: string;
  model_storage_display: string;
  model_storage_file_count: number;
  model_storage_complete: boolean;
  model_storage_measurement: 'recognized-logical-file-bytes';
  external_request_count: 0;
  product_version: string;
  node_major: number;
}

export interface CensusLocalDetails {
  agents: Array<{ name: string; kind: string; process_count: number }>;
  runtimes: Array<{ name: string; model_count: number; loaded_model_count: number }>;
  models: Array<{ name: string; source: string; loaded: boolean }>;
  tools: Array<{ name: string; status: 'configured' | 'online' }>;
  technical: {
    runtime_probes: Array<{ name: string; state: string; error_code: string | null }>;
    warnings: Array<{ code: string; message: string }>;
  };
}

export interface LocalScanView extends CensusShareSnapshot { local_details: CensusLocalDetails }

export interface LocalRescanOptions {
  endpoint: string;
  monitor_start_endpoint: string;
  monitor_stop_endpoint: string;
  monitor_stream_endpoint: string;
  monitor_clear_endpoint: string;
  contribution_preview_endpoint: string;
  session_token: string;
}

export interface AiFootprintPageOptions { rescan?: LocalRescanOptions; localDeviceLabel?: string }

function escapeHtml(value: string | number): string {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function safeScriptJson(value: unknown): string { return JSON.stringify(value).replaceAll('<', '\\u003c') }

function formatDecimalStorage(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes; let unit = 0;
  while (unit < units.length - 1 && value >= 1000) { value /= 1000; unit += 1; }
  return `${value.toFixed(value < 10 && unit > 1 ? 2 : value < 100 ? 1 : 0)} ${units[unit]}`;
}

function formatBinaryStorage(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  let value = bytes; let unit = 0;
  while (unit < units.length - 1 && value >= 1024) { value /= 1024; unit += 1; }
  return `${value.toFixed(value < 10 && unit > 1 ? 2 : value < 100 ? 1 : 0)} ${units[unit]}`;
}

function validateRescanOptions(rescan: LocalRescanOptions): void {
  for (const value of [rescan.endpoint, rescan.monitor_start_endpoint, rescan.monitor_stop_endpoint, rescan.monitor_stream_endpoint, rescan.monitor_clear_endpoint, rescan.contribution_preview_endpoint]) {
    if (!value.startsWith('/') || value.startsWith('//')) throw new Error('INVALID_LOCAL_RESCAN_OPTIONS');
  }
  if (!/^[a-f0-9]{48}$/.test(rescan.session_token)) throw new Error('INVALID_LOCAL_RESCAN_OPTIONS');
}

function runtimeLabel(name: string): string {
  if (name === 'ollama') return 'Ollama';
  if (name === 'lmstudio') return 'LM Studio';
  if (name === 'openai-compatible') return 'OpenAI-compatible';
  return name;
}

function sourceLabel(model: CensusReport['models'][number]): string {
  if (model.runtime === 'ollama') return 'Ollama';
  if (model.runtime === 'lmstudio') return 'LM Studio';
  if (model.location_hint === 'huggingface-cache') return 'Hugging Face cache';
  return model.source === 'filesystem' ? 'Local model files' : runtimeLabel(model.runtime);
}

function iconDataUrl(file: string): string | null {
  try { return `data:image/png;base64,${fs.readFileSync(path.join(__dirname, 'assets', file)).toString('base64')}`; }
  catch { return null; }
}

export function buildCensusShareSnapshot(report: CensusReport): CensusShareSnapshot {
  const decimal = formatDecimalStorage(report.summary.storage_bytes);
  const binary = formatBinaryStorage(report.summary.storage_bytes);
  return {
    generated_date: new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(report.generated_at)),
    architecture_label: report.system.architecture === 'arm64' ? 'Apple Silicon' : report.system.architecture === 'x64' ? 'Intel Mac' : report.system.architecture,
    model_record_count: report.summary.model_count,
    verified_runtime_count: report.summary.available_runtime_count,
    detected_agent_product_count: report.summary.agent_product_count,
    detected_agent_process_count: report.summary.agent_process_count,
    confirmed_running_model_count: report.summary.confirmed_running_model_count,
    model_storage_bytes: report.summary.storage_bytes,
    model_storage_decimal_display: decimal,
    model_storage_binary_display: binary,
    model_storage_display: decimal === binary ? decimal : `${decimal} · ${binary}`,
    model_storage_file_count: report.summary.storage_file_count,
    model_storage_complete: report.summary.storage_complete,
    model_storage_measurement: report.summary.storage_measurement,
    external_request_count: report.privacy.external_requests_made,
    product_version: report.product_version,
    node_major: report.system.node_major,
  };
}

export function buildLocalScanView(report: CensusReport): LocalScanView {
  return {
    ...buildCensusShareSnapshot(report),
    local_details: {
      agents: report.agents.map((agent) => ({ name: agent.name, kind: agent.kind, process_count: agent.instance_count })),
      runtimes: report.runtimes.filter((runtime) => runtime.name !== 'filesystem' && runtime.status === 'available').map((runtime) => ({
        name: runtimeLabel(runtime.name), model_count: runtime.model_count,
        loaded_model_count: report.models.filter((model) => model.runtime === runtime.name && model.evidence_status === 'confirmed-running').length,
      })),
      models: report.models.map((model) => ({ name: model.name, source: sourceLabel(model), loaded: model.evidence_status === 'confirmed-running' })),
      tools: report.tools.map((tool) => ({ name: tool.name, status: tool.evidence_status })),
      technical: {
        runtime_probes: report.runtimes.filter((runtime) => runtime.name !== 'filesystem').map((runtime) => ({
          name: runtimeLabel(runtime.name), state: runtime.evidence_status, error_code: runtime.error_code,
        })),
        warnings: report.warnings.map((warning) => ({ code: warning.code, message: warning.message })),
      },
    },
  };
}

export function renderCensusSharePage(report: CensusReport, options: AiFootprintPageOptions = {}): string {
  const snapshot = buildCensusShareSnapshot(report);
  const rescan = options.rescan;
  if (rescan) validateRescanOptions(rescan);
  const view = rescan ? buildLocalScanView(report) : null;
  const device = escapeHtml(options.localDeviceLabel ?? 'This Mac');
  const lightIcon = iconDataUrl('forkit-icon-light.png');
  const darkIcon = iconDataUrl('forkit-icon-dark.png');
  const brand = lightIcon ? `<picture><source media="(prefers-color-scheme:dark)" srcset="${darkIcon ?? lightIcon}"><img class="brand-icon" src="${lightIcon}" alt=""></picture>` : '<span class="brand-fallback">F</span>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>Forkit AI Footprints</title>
<style>
:root{--bg:#f3eee5;--paper:rgba(255,253,248,.88);--ink:#282624;--muted:#716c64;--line:rgba(42,38,34,.13);--teal:#007f82;--teal2:#d8ecea;--orange:#df8c27;--green:#247f67;--idle:#d8d1c7;--shadow:0 24px 70px rgba(36,32,28,.08)}
@media(prefers-color-scheme:dark){:root{--bg:#171817;--paper:rgba(35,36,34,.92);--ink:#f2ecdf;--muted:#aaa49a;--line:rgba(242,236,223,.13);--teal:#67beb8;--teal2:#203b39;--orange:#e2af23;--green:#62b99e;--idle:#45423e;--shadow:0 24px 70px rgba(0,0,0,.25)}}
*{box-sizing:border-box}html{background:var(--bg)}body{margin:0;color:var(--ink);background:radial-gradient(circle at 0 0,rgba(223,140,39,.15),transparent 32rem),radial-gradient(circle at 100% 0,rgba(0,128,128,.14),transparent 34rem),var(--bg);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}button,input{font:inherit}[hidden]{display:none!important}.shell{width:min(1040px,calc(100% - 36px));margin:auto;padding:22px 0 30px}.nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:26px}.brand{display:flex;align-items:center;gap:10px;font-weight:830;letter-spacing:-.03em}.brand-icon,.brand-fallback{width:42px;height:42px;border-radius:11px;object-fit:contain}.brand-fallback{display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,var(--teal),var(--orange))}.private{font-size:12px;color:var(--muted)}.private::before{content:'';display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;background:var(--green)}
.card{border:1px solid var(--line);border-radius:24px;background:var(--paper);box-shadow:var(--shadow);backdrop-filter:blur(18px)}.activity{padding:28px}.topline{display:flex;justify-content:space-between;gap:16px;align-items:start}.eyebrow{margin:0 0 9px;color:var(--teal);font-size:10px;font-weight:850;letter-spacing:.16em;text-transform:uppercase}h1,h2,h3,p{margin-top:0}.state-title{margin:0;font-size:clamp(33px,5vw,58px);line-height:.98;letter-spacing:-.055em}.state-copy{max-width:710px;margin:13px 0 0;color:var(--muted);font-size:13px;line-height:1.55}.badge{display:inline-flex;min-height:31px;align-items:center;padding:0 12px;border-radius:999px;background:var(--idle);font-size:10px;font-weight:850;white-space:nowrap}.badge.working{color:#fff;background:var(--green)}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:23px}.metric{min-height:104px;padding:16px;border:1px solid var(--line);border-radius:17px;background:rgba(255,255,255,.18)}.metric-label{color:var(--muted);font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.metric-value{margin-top:12px;font-size:26px;font-weight:820;letter-spacing:-.04em}.metric-note{margin-top:5px;color:var(--muted);font-size:9px;line-height:1.4}.context{display:flex;gap:20px;margin-top:15px;padding:12px 14px;border-radius:14px;background:var(--teal2);font-size:11px}.timeline{display:flex;height:13px;gap:2px;margin-top:18px;overflow:hidden;border-radius:999px;background:var(--idle)}.segment{min-width:4px;height:100%}.segment.working-now{background:var(--green)}.segment.open-idle{background:var(--orange)}.segment.not-running{background:var(--idle)}.legend{display:flex;gap:15px;margin-top:8px;color:var(--muted);font-size:9px}.legend i{display:inline-block;width:7px;height:7px;margin-right:5px;border-radius:50%}.legend .work{background:var(--green)}.legend .idle{background:var(--orange)}
.actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}.button{min-height:43px;padding:0 17px;border:1px solid var(--teal);border-radius:12px;color:#fff;background:var(--teal);font-weight:780;cursor:pointer}.button.secondary{border-color:var(--line);color:var(--ink);background:transparent}.button:disabled{cursor:not-allowed;opacity:.48}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.panel{padding:23px}.panel h2{margin-bottom:8px;font-size:24px;letter-spacing:-.04em}.panel-copy{color:var(--muted);font-size:11px;line-height:1.5}.guess-row{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:16px}.guess-row input{min-height:44px;border:1px solid var(--line);border-radius:12px;padding:0 13px;color:var(--ink);background:transparent;font-weight:760}.footprint-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:16px}.footprint-metrics .metric{min-height:92px}.footprint-metrics .metric-value{font-size:22px}.detail-list{display:grid;gap:9px;margin:12px 0 0;padding:0;list-style:none}.detail-list li{font-size:10px;color:var(--muted);line-height:1.45}.detail-list strong{display:block;color:var(--ink);font-size:11px}.privacy{margin-top:14px;padding:18px 20px}.privacy summary{cursor:pointer;font-size:12px;font-weight:800}.detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.detail-box{padding:15px;border:1px solid var(--line);border-radius:15px}.detail-box h3{font-size:13px}.payload{max-height:220px;overflow:auto;padding:13px;border:1px solid var(--line);border-radius:12px;background:rgba(0,0,0,.05);font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word}.footer{display:flex;justify-content:space-between;gap:20px;margin-top:20px;padding:0 4px;color:var(--muted);font-size:9px;line-height:1.5}
dialog{width:min(760px,calc(100% - 28px));border:0;border-radius:24px;padding:0;color:var(--ink);background:var(--paper);box-shadow:0 40px 100px rgba(0,0,0,.34)}dialog::backdrop{background:rgba(20,20,18,.62)}.dialog-body{padding:22px}.share-canvas{display:block;width:100%;height:auto;border-radius:16px}.share-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
@media(max-width:760px){.grid{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,1fr)}.detail-grid{grid-template-columns:1fr}.topline{display:block}.badge{margin-top:14px}.footer{display:block}.footer span{display:block;margin-top:5px}}@media(max-width:440px){.shell{width:calc(100% - 20px)}.activity,.panel{padding:18px}.metrics,.footprint-metrics{grid-template-columns:1fr}.guess-row{grid-template-columns:1fr}.state-title{font-size:38px}.private{max-width:120px;text-align:right}}
</style></head><body><main class="shell">
<header class="nav"><div class="brand">${brand}<span>Forkit AI Footprints</span></div><div class="private">Local on this device</div></header>
<section class="card activity"><div class="topline"><div><p class="eyebrow">AI activity now</p><h1 class="state-title" id="activity-title">Monitoring is off</h1><p class="state-copy" id="activity-copy">Start monitoring to distinguish supported AI apps that are working from apps that are only open.</p></div><span class="badge" id="activity-badge">STOPPED</span></div>
<div class="context" id="context" hidden><span id="chat-context"></span><span id="workspace-context"></span></div>
<div class="metrics"><div class="metric"><div class="metric-label">Observed</div><div class="metric-value" id="observed">0s</div><div class="metric-note">valid awake time</div></div><div class="metric"><div class="metric-label">AI active</div><div class="metric-value" id="active">0s</div><div class="metric-note">supported app work</div></div><div class="metric"><div class="metric-label">Activity ratio</div><div class="metric-value" id="ratio">—</div><div class="metric-note">active ÷ observed</div></div><div class="metric"><div class="metric-label">Forkit overhead</div><div class="metric-value" id="overhead">—</div><div class="metric-note" id="overhead-note">measured locally</div></div></div>
<div class="timeline" id="timeline" aria-label="AI activity timeline"></div><div class="legend"><span><i class="work"></i>Working</span><span><i class="idle"></i>Open / idle</span></div>
${rescan ? '<div class="actions"><button class="button" id="monitor-button" type="button">Start Monitoring</button><button class="button secondary" id="clear-button" type="button">Clear history</button></div>' : ''}</section>
<div class="grid"><section class="card panel"><p class="eyebrow">Your footprint</p><h2>Guess, then reveal.</h2><p class="panel-copy">How many supported local AI model records are on this Mac?</p><form class="guess-row" id="guess-form"><input id="guess-input" type="number" min="0" step="1" inputmode="numeric" placeholder="Your guess" required><button class="button" type="submit">Reveal</button></form><p class="panel-copy" id="guess-result">Your guess stays in this app.</p>
<div id="footprint" hidden><div class="footprint-metrics"><div class="metric"><div class="metric-label">Model records</div><div class="metric-value" id="models">${snapshot.model_record_count}</div><div class="metric-note" id="loaded">${snapshot.confirmed_running_model_count} loaded</div></div><div class="metric"><div class="metric-label">Model storage</div><div class="metric-value" id="storage">${escapeHtml(snapshot.model_storage_decimal_display)}</div><div class="metric-note">${escapeHtml(snapshot.model_storage_binary_display)} · recognized logical bytes</div></div><div class="metric"><div class="metric-label">Local engines</div><div class="metric-value" id="engines">${snapshot.verified_runtime_count}</div><div class="metric-note">verified available now</div></div></div><div class="actions"><button class="button" id="share-button" type="button">Create share card</button>${rescan ? '<button class="button secondary" id="scan-button" type="button">Scan again</button>' : ''}</div><p class="panel-copy" id="scan-status"></p></div></section>
<section class="card panel"><p class="eyebrow">Optional global comparison</p><h2 id="compare-title">Build a valid local session.</h2><p class="panel-copy" id="compare-copy">After 10 valid minutes, review the exact anonymous aggregate before choosing anything.</p><button class="button secondary" id="review-payload" type="button" disabled>Review exact payload</button><div id="consent" hidden><pre class="payload" id="payload"></pre><div class="actions"><button class="button" type="button" disabled title="Global contribution is not enabled in this local candidate">Share aggregates &amp; see my rank</button><button class="button secondary" id="keep-local" type="button">Keep everything local</button></div><p class="panel-copy">No account. No device identifier. Global transport remains disabled in this local candidate.</p></div></section></div>
${rescan ? '<details class="card privacy"><summary>Technical details</summary><div class="detail-grid"><section class="detail-box"><h3>Verified engines</h3><ul class="detail-list" id="runtime-list"></ul></section><section class="detail-box"><h3>Models on this Mac</h3><ul class="detail-list" id="model-list"></ul></section><section class="detail-box"><h3>Apps and tools</h3><ul class="detail-list" id="app-list"></ul></section><section class="detail-box"><h3>Probe notes</h3><ul class="detail-list" id="probe-list"></ul></section><section class="detail-box"><h3>Measurement boundary</h3><ul class="detail-list"><li><strong>Working now</strong>Sustained CPU-time deltas across repeated supported process-tree samples.</li><li><strong>Loaded model</strong>Provider API loaded-state, not proof of inference.</li><li><strong>Storage</strong>Exact logical bytes for recognized files in supported roots.</li></ul></section><section class="detail-box"><h3>Not measured</h3><ul class="detail-list"><li>Prompts, tokens, energy, cost, GPU attribution, per-app network traffic, or exclusive task ownership.</li></ul></section></div></details>' : ''}
<footer class="footer"><span>${device} · ${escapeHtml(snapshot.generated_date)} · ${escapeHtml(snapshot.architecture_label)}</span><span>No weights, prompts, commands, paths, config values, account data, or upload</span></footer></main>
<dialog id="share-dialog"><div class="dialog-body"><p class="eyebrow">Your AI Footprint</p><h2 id="share-heading">A local AI workshop, made visible.</h2><canvas class="share-canvas" id="share-canvas" width="1200" height="630"></canvas><div class="share-actions"><button class="button" id="download-share">Download PNG</button><button class="button secondary" id="native-share">Share image</button><button class="button secondary" id="copy-share">Copy words</button><button class="button secondary" id="close-share">Close</button></div><p class="panel-copy">Aggregate counts and durations only. Names and context stay out of the share.</p></div></dialog>
<script>
const initial=${safeScriptJson(view ?? snapshot)},config=${rescan ? safeScriptJson(rescan) : 'null'};let footprint={...initial},monitor={lifecycle:'stopped',observed_seconds:0,active_seconds:0,activity_ratio:null,products:[],timeline:[],overhead:{current_cpu_percent:null,current_memory_bytes:0,history_bytes:0,sample_count:0,median_cpu_percent:null,p95_cpu_percent:null,max_memory_bytes:0}};const $=id=>document.getElementById(id),plural=(n,a,b)=>n===1?a:(b||a+'s'),seconds=n=>n<60?Math.round(n)+'s':n<3600?Math.floor(n/60)+'m '+Math.round(n%60)+'s':Math.floor(n/3600)+'h '+Math.floor((n%3600)/60)+'m',pct=n=>n===null?'—':Math.round(n*100)+'%',bytes=n=>n<1000000?Math.round(n/1000)+' KB':(n/1000000).toFixed(1)+' MB';
function auth(url,options={}){return fetch(url,{...options,method:options.method||'POST',headers:{...(options.headers||{}),'x-forkit-footprints-session':config.session_token}})}function names(items){return items.map(item=>item.name)}function list(items){return items.length<2?items.join(''):items.slice(0,-1).join(', ')+' and '+items.at(-1)}function add(ul,title,copy){const li=document.createElement('li'),strong=document.createElement('strong');strong.textContent=title;li.append(strong,document.createTextNode(copy));ul.append(li)}
function renderMonitor(){const working=monitor.products.filter(p=>p.state==='working-now'),open=monitor.products.filter(p=>p.state==='open-idle'),badge=$('activity-badge');badge.className='badge';if(monitor.lifecycle==='stopped'){badge.textContent='STOPPED';$('activity-title').textContent=monitor.observed_seconds?'Monitoring stopped':'Monitoring is off';$('activity-copy').textContent=monitor.observed_seconds?'Your summary is preserved. Start again whenever you want.':'Start monitoring to distinguish supported AI apps that are working from apps that are only open.';$('monitor-button')&&($('monitor-button').textContent='Start Monitoring')}else if(working.length){badge.textContent='WORKING NOW';badge.classList.add('working');$('activity-title').textContent=list(names(working))+(working.length===1?' is':' are')+' working now';$('activity-copy').textContent='Sustained recent work is present in the supported app process tree.';$('monitor-button')&&($('monitor-button').textContent='Stop Monitoring')}else if(open.length){badge.textContent='OPEN / IDLE';$('activity-title').textContent=list(names(open))+(open.length===1?' is':' are')+' open / idle';$('activity-copy').textContent='The supported app exists, but recent samples do not show sustained work.';$('monitor-button')&&($('monitor-button').textContent='Stop Monitoring')}else{badge.textContent='NOT RUNNING';$('activity-title').textContent='No supported AI app is running';$('activity-copy').textContent='Monitoring is active. A supported app will appear when it starts.';$('monitor-button')&&($('monitor-button').textContent='Stop Monitoring')}
$('observed').textContent=seconds(monitor.observed_seconds);$('active').textContent=seconds(monitor.active_seconds);$('ratio').textContent=pct(monitor.activity_ratio);$('overhead').textContent=monitor.overhead.current_cpu_percent===null?'warming up':monitor.overhead.current_cpu_percent.toFixed(1)+'% CPU';$('overhead-note').textContent=bytes(monitor.overhead.current_memory_bytes)+' RAM · '+bytes(monitor.overhead.history_bytes)+' history';const ctx=[...working,...open].find(p=>p.context&&(p.context.chat||p.context.workspace))?.context;$('context').hidden=!ctx;if(ctx){$('chat-context').textContent=ctx.chat?'Chat · '+ctx.chat:'';$('workspace-context').textContent=ctx.workspace?'Workspace · '+ctx.workspace:''}
const timeline=$('timeline');timeline.replaceChildren();const total=Math.max(1,monitor.timeline.reduce((n,s)=>n+Math.max(1,new Date(s.ended_at)-new Date(s.started_at)),0));for(const s of monitor.timeline){const el=document.createElement('span');el.className='segment '+s.state;el.style.flex=String(Math.max(1,new Date(s.ended_at)-new Date(s.started_at))/total);timeline.append(el)}$('review-payload').disabled=monitor.observed_seconds<600;$('compare-title').textContent=monitor.observed_seconds>=600?'Your session is ready to compare.':'Build a valid local session.';$('compare-copy').textContent=monitor.observed_seconds>=600?'Review the exact anonymous aggregate. Storage will never determine rank.':'After 10 valid minutes, review the exact anonymous aggregate before choosing anything.'}
function renderDetails(){if(!config||!footprint.local_details)return;const d=footprint.local_details,rl=$('runtime-list'),ml=$('model-list'),al=$('app-list'),pl=$('probe-list');for(const x of [rl,ml,al,pl])x.replaceChildren();for(const r of d.runtimes)add(rl,r.name,r.loaded_model_count?r.loaded_model_count+' '+plural(r.loaded_model_count,'model')+' loaded':r.model_count+' installed · no model loaded');if(!d.runtimes.length)add(rl,'No verified local engine available','');for(const m of d.models)add(ml,m.name,m.source+' · '+(m.loaded?'loaded':'stored'));if(!d.models.length)add(ml,'No supported model record found','');for(const a of d.agents)add(al,a.name,'Process exists · activity decided by monitoring');const seen=new Set(d.agents.map(a=>a.name));for(const t of d.tools.filter(t=>!seen.has(t.name)))add(al,t.name,t.status==='online'?'Process exists':'Detected · not running');if(!d.agents.length&&!d.tools.length)add(al,'No supported app or tool detected','');for(const p of d.technical.runtime_probes)add(pl,p.name,p.state+(p.error_code?' · '+p.error_code:''));for(const w of d.technical.warnings)add(pl,w.code,w.message);if(!d.technical.runtime_probes.length&&!d.technical.warnings.length)add(pl,'No probe notes','')}
function reveal(guess){const actual=footprint.model_record_count,d=Math.abs(guess-actual);$('guess-result').textContent=guess===actual?'Exactly right — '+actual+' '+plural(actual,'model record')+'.':d<=2?'Close — you guessed '+guess+'; this scan found '+actual+'.':'You guessed '+guess+'; this scan found '+actual+'.';$('footprint').hidden=false;localStorage.setItem('forkit-footprints-guess',String(guess));localStorage.setItem('forkit-footprints-revealed','1')}function insight(){if(monitor.observed_seconds&&monitor.activity_ratio>=.75)return'My AI workshop was active '+pct(monitor.activity_ratio)+'.';if(monitor.active_seconds>0)return'I turned '+seconds(monitor.active_seconds)+' of AI work into a visible footprint.';if(footprint.model_storage_bytes>=100000000000)return'My Mac holds a serious local AI library.';if(footprint.model_record_count>=5)return'A local AI workshop, made visible.';return'I found the AI already on my Mac.'}function shareWords(){const activity=monitor.observed_seconds?' I observed '+seconds(monitor.observed_seconds)+' and supported AI apps were working for '+seconds(monitor.active_seconds)+' ('+pct(monitor.activity_ratio)+').':'';return insight()+' My Mac holds '+footprint.model_record_count+' supported local AI model records and '+footprint.model_storage_decimal_display+' of recognized model files.'+activity+' I used Forkit AI Footprints to make the local system visible.'}
function draw(){const c=$('share-canvas'),x=c.getContext('2d'),g=x.createLinearGradient(0,0,1200,630);g.addColorStop(0,'#f5e6d5');g.addColorStop(.58,'#f3eee5');g.addColorStop(1,'#d6ebe9');x.fillStyle=g;x.fillRect(0,0,1200,630);x.fillStyle='#007f82';x.font='800 28px Inter,sans-serif';x.fillText('Forkit AI Footprints',68,86);x.fillStyle='#282624';x.font='800 55px Inter,sans-serif';x.fillText(insight(),68,178);const cards=[['MODEL RECORDS',String(footprint.model_record_count)],['MODEL STORAGE',footprint.model_storage_decimal_display],['OBSERVED',seconds(monitor.observed_seconds)],['AI ACTIVE',monitor.observed_seconds?pct(monitor.activity_ratio):'—']];cards.forEach((v,i)=>{const px=68+i*270;x.fillStyle='rgba(255,253,248,.84)';x.beginPath();x.roundRect(px,270,245,155,22);x.fill();x.fillStyle='#716c64';x.font='800 14px Inter,sans-serif';x.fillText(v[0],px+20,309);x.fillStyle='#282624';x.font='800 37px Inter,sans-serif';x.fillText(v[1],px+20,374)});x.fillStyle='#716c64';x.font='500 18px Inter,sans-serif';x.fillText('Measured locally. Shared as aggregate facts.',68,535)}
$('guess-form').addEventListener('submit',e=>{e.preventDefault();reveal(Number($('guess-input').value))});const saved=localStorage.getItem('forkit-footprints-guess');if(saved!==null)$('guess-input').value=saved;if(localStorage.getItem('forkit-footprints-revealed')==='1'&&saved!==null)reveal(Number(saved));
const dialog=$('share-dialog');$('share-button').addEventListener('click',()=>{$('share-heading').textContent=insight();draw();dialog.showModal()});$('close-share').addEventListener('click',()=>dialog.close());function blob(){return new Promise(resolve=>$('share-canvas').toBlob(resolve,'image/png'))}$('download-share').addEventListener('click',async()=>{const b=await blob();if(!b)return;const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='my-forkit-ai-footprint.png';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)});$('copy-share').addEventListener('click',async()=>{await navigator.clipboard.writeText(shareWords());$('copy-share').textContent='Copied'});$('native-share').addEventListener('click',async()=>{const b=await blob();if(!b)return;const f=new File([b],'my-forkit-ai-footprint.png',{type:'image/png'});if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[f]})))await navigator.share({title:'My Forkit AI Footprint',text:shareWords(),files:[f]});else await navigator.clipboard.writeText(shareWords())});
if(config){$('monitor-button').addEventListener('click',async()=>{const endpoint=monitor.lifecycle==='monitoring'?config.monitor_stop_endpoint:config.monitor_start_endpoint;const r=await auth(endpoint);if(r.ok){monitor=await r.json();renderMonitor()}});$('clear-button').addEventListener('click',async()=>{if(!confirm('Clear this local monitoring history?'))return;const r=await auth(config.monitor_clear_endpoint);if(r.ok){monitor=await r.json();renderMonitor()}});$('scan-button').addEventListener('click',async()=>{const b=$('scan-button');b.disabled=true;$('scan-status').textContent='Scanning local metadata…';try{const r=await auth(config.endpoint);if(!r.ok)throw 0;footprint=await r.json();renderDetails();$('scan-status').textContent='Footprint refreshed locally.'}catch{$('scan-status').textContent='Scan could not be refreshed.'}finally{b.disabled=false}});$('review-payload').addEventListener('click',async()=>{const r=await auth(config.contribution_preview_endpoint);if(!r.ok)return;$('payload').textContent=JSON.stringify(await r.json(),null,2);$('consent').hidden=false});$('keep-local').addEventListener('click',()=>{$('consent').hidden=true});(async()=>{try{const r=await auth(config.monitor_stream_endpoint);if(!r.ok||!r.body)return;const reader=r.body.getReader(),decoder=new TextDecoder();let buf='';while(true){const part=await reader.read();if(part.done)break;buf+=decoder.decode(part.value,{stream:true});const lines=buf.split('\\n');buf=lines.pop()||'';for(const line of lines)if(line){monitor=JSON.parse(line);renderMonitor()}}}catch{}})();renderDetails()}
renderMonitor();
</script></body></html>`;
}
