import type { CensusReport } from './types';
import type { DoctorReport } from './doctor';

function line(label: string, value: string | number): string {
  return `  ${label.padEnd(20)} ${value}`;
}

export function formatCensusReport(report: CensusReport): string {
  const output = [
    'Forkit Census',
    'Metadata-only local AI inventory',
    '-'.repeat(72),
    line('census id', report.census_id),
    line('generated', report.generated_at),
    line('system', `${report.system.platform}/${report.system.architecture} · Node ${report.system.node_major}`),
    line('runtimes', `${report.summary.available_runtime_count} available / ${report.summary.runtime_count} observed`),
    line('models', report.summary.model_count),
    line('agent products', report.summary.agent_product_count),
    line('agent processes', report.summary.agent_process_count),
    line('warnings', report.summary.warning_count),
    line('privacy', 'metadata only · no file contents · no raw commands · no credentials'),
  ];

  if (report.models.length > 0) {
    output.push('', 'Models');
    for (const model of report.models) {
      output.push(`  - ${model.name} · ${model.runtime} · ${model.confidence} confidence · ${model.identity_kind}`);
    }
  }
  if (report.agents.length > 0) {
    output.push('', 'Agent products');
    for (const agent of report.agents) {
      output.push(`  - ${agent.name} · ${agent.kind} · ${agent.confidence} confidence · ${agent.instance_count} process(es)`);
    }
  }
  if (report.warnings.length > 0) {
    output.push('', 'Review notes');
    for (const warning of report.warnings) output.push(`  - ${warning.message}`);
  }
  return `${output.join('\n')}\n`;
}

export function formatDoctorReport(report: DoctorReport): string {
  const output = [
    'Forkit Census Doctor',
    '-'.repeat(72),
    ...report.checks.map((check) => line(check.name, `${check.ok ? 'ok' : 'failed'} · ${check.detail}`)),
  ];
  return `${output.join('\n')}\n`;
}
