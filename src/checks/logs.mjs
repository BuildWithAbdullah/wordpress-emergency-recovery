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

const PATTERNS = [
  { id: 'LOG002', re: /Allowed memory size of (\d+) bytes exhausted[^\n]*/i },
  { id: 'LOG003', re: /Maximum execution time of (\d+) seconds? exceeded[^\n]*/i },
  { id: 'LOG004', re: /Cannot redeclare ([A-Za-z0-9_\\:]+)[^\n]*/i },
  { id: 'LOG005', re: /headers already sent[^\n]*/i },
  { id: 'LOG001', re: /PHP Fatal error:[^\n]*/i }
];

export function run(ctx) {
  const out = [];
  const seen = new Set();

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

    for (const p of PATTERNS) {
      const m = text.match(p.re);
      if (!m) continue;
      const key = `${p.id}:${rel}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const at = text.slice(m.index).match(/in (\/[^\s:]+|[A-Za-z]:[^\s:]+) on line (\d+)/);
      out.push(make(p.id, {
        file: rel,
        line: lineOf(text, m.index),
        excerpt: excerpt(text, m.index, 160)
      }, {
        detail: at ? `Names ${at[1]} line ${at[2]}.` : ''
      }));
    }
  }

  return out;
}
