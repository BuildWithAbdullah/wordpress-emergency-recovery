import { make } from '../findings.mjs';
import { lineOf, excerpt } from '../scan.mjs';

export const id = 'logs';
export const title = 'PHP error logs';
export const describes = 'The fatal errors, memory ceilings and early output the install has already recorded about itself.';

const LOG_NAMES = [
  'wp-content/debug.log',
  'error_log',
  'php_errorlog',
  'wp-content/error_log',
  'wp-admin/error_log',
  'wp-includes/error_log',
  'logs/error.log'
];

const LARGE = 5 * 1024 * 1024;

// Ordered, and the order is the point. PHP writes an exhausted memory
// ceiling as a fatal error, so one line matches both the specific pattern
// and the general one. Reporting both puts the same line in the queue twice
// under two ids whose next actions disagree: one says read the allocation
// size, the other says open the file named at the end. The specific reason
// wins and the general one is the fallback for a fatal error that is none of
// them.
const SPECIFIC = [
  { id: 'LOG002', re: /Allowed memory size of (\d+) bytes exhausted/i },
  { id: 'LOG003', re: /Maximum execution time of (\d+) seconds? exceeded/i },
  { id: 'LOG004', re: /Cannot redeclare ([A-Za-z0-9_\\:]+)/i },
  { id: 'LOG005', re: /headers already sent/i }
];

const GENERAL = { id: 'LOG001', re: /PHP Fatal error:/i };

const AT = /in (\/[^\s:]+|[A-Za-z]:[^\s:]+) on line (\d+)/;

// One line, one reason. Returns the id this line should be reported under,
// or null if the line is not one of the shapes the tool knows.
export function classify(line) {
  for (const p of SPECIFIC) {
    if (p.re.test(line)) return p.id;
  }
  return GENERAL.re.test(line) ? GENERAL.id : null;
}

export function run(ctx) {
  const out = [];

  const candidates = LOG_NAMES.filter((n) => ctx.has(n));
  for (const f of ctx.files) {
    if (f.dir) continue;
    if (/(^|\/)(debug|error|php_error)[-_.]?\w*\.log$/i.test(f.rel) && !candidates.includes(f.rel)) {
      candidates.push(f.rel);
    }
  }

  for (const rel of candidates) {
    const entry = ctx.get(rel);
    if (!entry) continue;

    if (rel.startsWith('wp-content/') || !rel.includes('/')) {
      out.push(make('LOG006', { file: rel }, { detail: `${entry.size} bytes.` }));
    }
    if (entry.size > LARGE) {
      out.push(make('LOG007', { file: rel }, { detail: `${Math.round(entry.size / (1024 * 1024))} MB.` }));
    }

    const text = ctx.readText(rel);
    if (text === null) continue;

    // Walked line by line, keeping the character offset, so the reported
    // line number is the line in the file and the excerpt is that line.
    const seen = new Set();
    let offset = 0;
    for (const line of text.split('\n')) {
      const id = classify(line);
      if (id && !seen.has(id)) {
        seen.add(id);
        const at = line.match(AT);
        out.push(make(id, {
          file: rel,
          line: lineOf(text, offset),
          excerpt: excerpt(text, offset, 160)
        }, {
          detail: at ? `Names ${at[1]} line ${at[2]}.` : ''
        }));
      }
      offset += line.length + 1;
    }
  }

  return out;
}
