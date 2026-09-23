import { SEVERITIES } from '../findings.mjs';

const RULE = '-'.repeat(72);

export function render(result, options = {}) {
  const lines = [];
  lines.push('wp-triage');
  lines.push(RULE);
  lines.push(`Root        ${result.root}`);
  lines.push(`Scanned     ${result.scannedAt}`);
  lines.push(`Files seen  ${result.filesSeen}${result.truncated ? ' (limit reached, results are partial)' : ''}`);
  lines.push(`Checks      ${result.checksRun.join(', ')}`);
  const summary = SEVERITIES.filter((s) => result.counts[s] > 0).map((s) => `${result.counts[s]} ${s}`);
  lines.push(`Findings    ${result.findings.length === 0 ? 'none' : summary.join(', ')}`);
  lines.push('');

  if (result.checkErrors.length > 0) {
    lines.push('Checks that could not complete:');
    for (const e of result.checkErrors) lines.push(`  ${e.check}: ${e.message}`);
    lines.push('');
  }

  if (result.findings.length === 0) {
    lines.push('No findings. That is not a clean bill of health: read the Limits');
    lines.push('section of the README for what this tool cannot see.');
    return lines.join('\n');
  }

  let n = 0;
  for (const f of result.findings) {
    n += 1;
    lines.push(`${String(n).padStart(3, ' ')}. [${f.severity.toUpperCase()}] ${f.id}  ${f.title}`);
    if (f.evidence.file) {
      lines.push(`     where        ${f.evidence.file}${f.evidence.line ? `:${f.evidence.line}` : ''}`);
    }
    if (f.evidence.excerpt) lines.push(`     evidence     ${f.evidence.excerpt}`);
    if (f.detail) lines.push(`     detail       ${f.detail}`);
    lines.push(`     next action  ${wrap(f.nextAction)}`);
    lines.push(`     not proof of ${wrap(f.doesNotProve)}`);
    lines.push('');
  }

  lines.push(RULE);
  lines.push('Every finding above is a place to look. None of them is a conclusion.');
  return lines.join('\n');
}

const CONTINUATION = ' '.repeat(18);

function wrap(text) {
  const width = 72 - CONTINUATION.length;
  const words = text.split(' ');
  const rows = [];
  let row = '';
  for (const w of words) {
    if ((row + ' ' + w).trim().length > width) { rows.push(row.trim()); row = w; }
    else row += ' ' + w;
  }
  if (row.trim()) rows.push(row.trim());
  return rows.join('\n' + CONTINUATION);
}
