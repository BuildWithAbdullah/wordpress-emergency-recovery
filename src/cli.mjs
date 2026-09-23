import { triage, exitCodeFor } from './triage.mjs';
import { renderReport, FORMATS } from './report/index.mjs';
import { CHECKS } from './checks/index.mjs';
import { CATALOGUE, SEVERITIES } from './findings.mjs';

export const USAGE = `wp-triage <path-to-wordpress-root> [options]

Reads a WordPress install from the filesystem and reports what it finds.
It never writes to the install, never opens a database connection, and
never makes a network request.

Options
  --format <text|markdown|json>  Report format. Default text.
  --only <ids>                   Comma separated check ids to run.
  --skip <ids>                   Comma separated check ids to skip.
  --fail-on <severity>           Exit 1 at this severity or above. Default high.
  --list-checks                  Print the check modules and exit.
  --list-findings                Print the finding catalogue and exit.
  --help                         Print this message.

Exit codes
  0  no finding at or above the fail-on severity
  1  at least one finding at or above it
  2  the run could not complete
`;

export function parseArgs(argv) {
  const opts = { path: null, format: 'text', only: [], skip: [], failOn: 'high', listChecks: false, listFindings: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--list-checks') opts.listChecks = true;
    else if (a === '--list-findings') opts.listFindings = true;
    else if (a === '--format') opts.format = argv[++i];
    else if (a === '--only') opts.only = String(argv[++i] || '').split(',').filter(Boolean);
    else if (a === '--skip') opts.skip = String(argv[++i] || '').split(',').filter(Boolean);
    else if (a === '--fail-on') opts.failOn = argv[++i];
    else if (a.startsWith('-')) throw new Error(`unknown option: ${a}`);
    else if (opts.path === null) opts.path = a;
    else throw new Error(`unexpected argument: ${a}`);
  }
  if (!opts.help && !opts.listChecks && !opts.listFindings) {
    if (!opts.path) throw new Error('a path to the WordPress root is required');
    if (!FORMATS[opts.format]) throw new Error(`unknown format: ${opts.format}`);
    if (!SEVERITIES.includes(opts.failOn)) throw new Error(`unknown severity: ${opts.failOn}`);
    const ids = new Set(CHECKS.map((c) => c.id));
    for (const id of [...opts.only, ...opts.skip]) {
      if (!ids.has(id)) throw new Error(`unknown check: ${id}`);
    }
  }
  return opts;
}

export function listChecks() {
  return CHECKS.map((c) => `${c.id.padEnd(13)} ${c.describes}`).join('\n');
}

export function listFindings() {
  return Object.entries(CATALOGUE)
    .map(([id, e]) => `${id.padEnd(11)} ${e.severity.padEnd(9)} ${e.check.padEnd(13)} ${e.title}`)
    .join('\n');
}

export function main(argv, io = console) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    io.error(`wp-triage: ${err.message}`);
    io.error('');
    io.error(USAGE);
    return 2;
  }

  if (opts.help) { io.log(USAGE); return 0; }
  if (opts.listChecks) { io.log(listChecks()); return 0; }
  if (opts.listFindings) { io.log(listFindings()); return 0; }

  let result;
  try {
    result = triage(opts.path, { only: opts.only, skip: opts.skip });
  } catch (err) {
    io.error(`wp-triage: ${err.message}`);
    return 2;
  }

  io.log(renderReport(result, opts.format));
  return exitCodeFor(result, opts.failOn);
}
