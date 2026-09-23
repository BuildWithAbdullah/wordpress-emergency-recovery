import { make } from '../findings.mjs';
import { matches } from '../scan.mjs';

export const id = 'obfuscation';
export const title = 'Obfuscation signatures';
export const describes = 'Shapes that hide what code does. A signature is a reason to read the file, never a verdict on it.';

const LONG_LINE = 2000;

const RULES = [
  { id: 'OBF001', re: /\beval\s*\(\s*(?:@\s*)?base64_decode\s*\(/i },
  { id: 'OBF002', re: /\beval\s*\(\s*(?:@\s*)?(?:gzinflate|gzuncompress|str_rot13|gzdecode|convert_uudecode)\s*\(/i },
  { id: 'OBF003', re: /\bpreg_replace\s*\(\s*(['"]).*?\1\s*\.?\s*['"]?\w*e\w*['"]?\s*,/i },
  { id: 'OBF004', re: /\bcreate_function\s*\(/i },
  { id: 'OBF006', re: /['"][A-Za-z0-9_]{1,6}['"]\s*\.\s*['"][A-Za-z0-9_]{1,6}['"]\s*\.\s*['"][A-Za-z0-9_]{1,6}['"]/ },
  { id: 'OBF007', re: /\bassert\s*\(\s*\$[A-Za-z_]\w*\s*\)/i }
];

const PREG_E = /\bpreg_replace\s*\(\s*(['"])(.*?)\1\s*,/i;
const BLOB = /['"][A-Za-z0-9+/=]{200,}['"]/;

export function run(ctx) {
  const out = [];

  for (const f of ctx.phpFiles()) {
    const text = ctx.readText(f.rel);
    if (text === null) continue;

    for (const rule of RULES) {
      if (rule.id === 'OBF003') continue;
      const hits = matches(text, rule.re, 3);
      for (const h of hits) {
        out.push(make(rule.id, { file: f.rel, line: h.line, excerpt: h.excerpt }));
      }
    }

    // The /e modifier lives after the closing delimiter, so it needs the
    // pattern parsed rather than matched in one go.
    const preg = text.match(PREG_E);
    if (preg) {
      const pattern = preg[2] || '';
      const delim = pattern.charAt(0);
      const end = pattern.lastIndexOf(delim);
      const modifiers = end > 0 ? pattern.slice(end + 1) : '';
      if (modifiers.includes('e')) {
        const hits = matches(text, PREG_E, 1);
        out.push(make('OBF003', { file: f.rel, line: hits[0]?.line || 1, excerpt: hits[0]?.excerpt || '' }));
      }
    }

    const blob = text.match(BLOB);
    if (blob) {
      const hits = matches(text, BLOB, 1);
      out.push(make('OBF005', { file: f.rel, line: hits[0]?.line || 1, excerpt: `${blob[0].length} character encoded string` }, {
        detail: `Longest encoded run is ${blob[0].length} characters.`
      }));
    }

    let lineNo = 0;
    for (const line of text.split('\n')) {
      lineNo += 1;
      if (line.length > LONG_LINE) {
        out.push(make('OBF008', { file: f.rel, line: lineNo, excerpt: `${line.length} characters on one line` }));
        break;
      }
    }
  }

  return out;
}
