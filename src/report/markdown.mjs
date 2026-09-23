import { SEVERITIES } from '../findings.mjs';

export function render(result) {
  const out = [];
  out.push('# wp-triage report');
  out.push('');
  out.push(`- Root: \`${result.root}\``);
  out.push(`- Scanned: ${result.scannedAt}`);
  out.push(`- Files seen: ${result.filesSeen}${result.truncated ? ' (limit reached, results are partial)' : ''}`);
  out.push(`- Checks run: ${result.checksRun.join(', ')}`);
  out.push('');

  out.push('## Summary');
  out.push('');
  out.push('| Severity | Count |');
  out.push('|---|---|');
  for (const s of SEVERITIES) out.push(`| ${s} | ${result.counts[s]} |`);
  out.push('');

  if (result.findings.length === 0) {
    out.push('No findings. That is not a clean bill of health. Read the Limits section');
    out.push('of the README for what this tool cannot see.');
    return out.join('\n');
  }

  out.push('## Findings');
  out.push('');
  for (const f of result.findings) {
    out.push(`### ${f.id} ${f.title}`);
    out.push('');
    out.push(`**Severity:** ${f.severity}  `);
    if (f.evidence.file) out.push(`**Where:** \`${f.evidence.file}${f.evidence.line ? `:${f.evidence.line}` : ''}\`  `);
    if (f.evidence.excerpt) out.push(`**Evidence:** \`${f.evidence.excerpt.replace(/`/g, "'")}\`  `);
    if (f.detail) out.push(`**Detail:** ${f.detail}  `);
    out.push('');
    out.push(`**Next action.** ${f.nextAction}`);
    out.push('');
    out.push(`**What it does not prove.** ${f.doesNotProve}`);
    out.push('');
  }

  out.push('---');
  out.push('');
  out.push('Every finding above is a place to look. None of them is a conclusion.');
  return out.join('\n');
}
