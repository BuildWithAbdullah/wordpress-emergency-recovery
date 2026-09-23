import { buildContext, DEFAULT_LIMITS } from './scan.mjs';
import { CHECKS } from './checks/index.mjs';
import { severityRank, SEVERITIES } from './findings.mjs';

export function triage(root, options = {}) {
  const started = Date.now();
  const ctx = buildContext(root, options.limits || DEFAULT_LIMITS);
  const only = options.only && options.only.length ? new Set(options.only) : null;
  const skip = options.skip && options.skip.length ? new Set(options.skip) : null;

  const findings = [];
  const ran = [];
  const errors = [];

  for (const check of CHECKS) {
    if (only && !only.has(check.id)) continue;
    if (skip && skip.has(check.id)) continue;
    ran.push(check.id);
    try {
      for (const f of check.run(ctx)) findings.push(f);
    } catch (err) {
      errors.push({ check: check.id, message: err.message });
    }
  }

  findings.sort((a, b) => {
    const s = severityRank(a.severity) - severityRank(b.severity);
    if (s !== 0) return s;
    if (a.check !== b.check) return a.check < b.check ? -1 : 1;
    return (a.evidence.file || '').localeCompare(b.evidence.file || '');
  });

  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  for (const f of findings) counts[f.severity] += 1;

  return {
    tool: 'wp-triage',
    root: ctx.root,
    scannedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    filesSeen: ctx.files.length,
    truncated: ctx.truncated,
    checksRun: ran,
    checkErrors: errors,
    counts,
    findings
  };
}

// Exit codes are what makes this usable from a pipeline.
//   0  nothing at or above the threshold
//   1  at least one finding at or above the threshold
//   2  the run could not complete
export function exitCodeFor(result, threshold = 'high') {
  const limit = severityRank(threshold);
  return result.findings.some((f) => severityRank(f.severity) <= limit) ? 1 : 0;
}
