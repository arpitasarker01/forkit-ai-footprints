import type { CensusReport } from './types';
import type { DoctorReport } from './doctor';

function line(label: string, value: string | number): string {
  return `  ${label.padEnd(20)} ${value}`;
}

export function formatCensusReport(report: CensusReport, options: { verbose?: boolean } = {}): string {
  const output = [
    'Forkit AI Footprints',
    'Metadata-only local AI inventory',
    '-'.repeat(72),
    line('census id', report.census_id),
    line('generated', report.generated_at),
    line('system', `${report.system.platform}/${report.system.architecture} · Node ${report.system.node_major}`),
    line('runtimes', `${report.summary.available_runtime_count} available / ${report.summary.runtime_count} observed`),
    line('models', `${report.summary.model_count} discovered · ${report.summary.confirmed_running_model_count} confirmed running`),
    line('model storage', `${(report.summary.storage_bytes / (1024 ** 3)).toFixed(2)} GB · ${report.summary.storage_bytes.toLocaleString('en-US')} recognized bytes`),
    line('agent products', report.summary.agent_product_count),
    line('agent processes', report.summary.agent_process_count),
    line('agent CPU snapshot', report.summary.agent_cpu_percent === null ? 'unavailable' : `${report.summary.agent_cpu_percent.toFixed(1)}%`),
    line('agent memory snap.', report.summary.agent_memory_percent === null ? 'unavailable' : `${report.summary.agent_memory_percent.toFixed(1)}%`),
    line('AI tools', report.summary.tool_count),
    line('MCP configs', report.summary.mcp_config_count),
    line('warnings', report.summary.warning_count),
    line('privacy', 'metadata only · no model bytes · no retained commands/config values'),
  ];

  if (report.models.length > 0) {
    output.push('', 'Models');
    for (const model of report.models) {
      output.push(`  - ${model.name} · ${model.runtime} · ${model.evidence_status} · ${model.confidence} confidence${options.verbose ? ` · ${model.identity_kind}` : ''}`);
    }
  }
  if (report.runtimes.length > 0) {
    output.push('', 'Runtimes');
    for (const runtime of report.runtimes) {
      output.push(`  - ${runtime.name} · ${runtime.evidence_status} · ${runtime.model_count} model(s)`);
    }
  }
  if (report.agents.length > 0) {
    output.push('', 'Agent products');
    for (const agent of report.agents) {
      output.push(`  - ${agent.name} · ${agent.kind} · ${agent.confidence} confidence · ${agent.instance_count} process(es)`);
    }
  }
  if (report.tools.length > 0) {
    output.push('', 'AI tools and environments');
    for (const tool of report.tools) {
      output.push(`  - ${tool.name} · ${tool.evidence_status} · ${tool.confidence} confidence${options.verbose ? ` · ${tool.detector_types.join('+')}` : ''}`);
    }
  }
  if (report.mcp_configs.length > 0) {
    output.push('', 'MCP configurations');
    for (const config of report.mcp_configs) {
      output.push(`  - ${config.client} · configured · ${config.server_count} server config(s)`);
    }
  }
  if (report.guess.provided !== null) {
    const difference = report.guess.difference ?? 0;
    output.push('', `Your guess: ${report.guess.provided} · discovered: ${report.guess.discovered} · difference: ${difference >= 0 ? '+' : ''}${difference}`);
  }
  if (report.warnings.length > 0) {
    output.push('', 'Review notes');
    for (const warning of report.warnings) output.push(`  - ${warning.message}`);
  }
  output.push('', 'Optional next step: use Forkit Connect if you later choose Passport review and an explicit final Mint. AI Footprints has not created or registered anything.');
  return `${output.join('\n')}\n`;
}

export function formatDoctorReport(report: DoctorReport): string {
  const output = [
    'Forkit AI Footprints Doctor',
    '-'.repeat(72),
    ...report.checks.map((check) => line(check.name, `${check.ok ? 'ok' : 'failed'} · ${check.detail}`)),
  ];
  return `${output.join('\n')}\n`;
}
