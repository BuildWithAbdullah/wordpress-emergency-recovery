import { make } from '../findings.mjs';
import { lineOf, excerpt, matches } from '../scan.mjs';

export const id = 'config';
export const title = 'wp-config.php';
export const describes = 'Constants that decide how errors surface, where logs land, and what secrets the install uses.';

const PLACEHOLDERS = [
  'database_name_here',
  'username_here',
  'password_here',
  'localhost_here'
];

export function run(ctx) {
  const rel = 'wp-config.php';
  const text = ctx.readText(rel);
  if (text === null) return [];
  const out = [];

  const constant = (name) => {
    const re = new RegExp(`define\\s*\\(\\s*['"]${name}['"]\\s*,\\s*([^)]*)\\)`, 'i');
    const m = text.match(re);
    if (!m) return null;
    return { raw: m[1].trim(), line: lineOf(text, m.index), excerpt: excerpt(text, m.index) };
  };
  const truthy = (v) => v !== null && /^(true|1|'1')$/i.test(v.raw);
  const falsy = (v) => v !== null && /^(false|0|'0')$/i.test(v.raw);

  // Bytes before the opening tag. Checked first, because when this is wrong
  // nothing else about the file matters.
  const openIdx = text.indexOf('<?php');
  if (openIdx > 0) {
    out.push(make('CONFIG007', {
      file: rel,
      line: 1,
      excerpt: JSON.stringify(text.slice(0, Math.min(openIdx, 40)))
    }, { detail: `${openIdx} byte(s) precede the opening tag.` }));
  }

  const debug = constant('WP_DEBUG');
  const display = constant('WP_DEBUG_DISPLAY');
  if (truthy(debug) && !falsy(display)) {
    out.push(make('CONFIG001', { file: rel, line: debug.line, excerpt: debug.excerpt }, {
      detail: display === null
        ? 'WP_DEBUG_DISPLAY is not defined, so it defaults to on.'
        : `WP_DEBUG_DISPLAY is ${display.raw}.`
    }));
  }

  const log = constant('WP_DEBUG_LOG');
  if (log && /wp-content|^'?\.\//.test(log.raw)) {
    out.push(make('CONFIG002', { file: rel, line: log.line, excerpt: log.excerpt }));
  } else if (truthy(log)) {
    out.push(make('CONFIG002', { file: rel, line: log.line, excerpt: log.excerpt }, {
      detail: 'WP_DEBUG_LOG is true, which writes to wp-content/debug.log by default.'
    }));
  }

  for (const ph of PLACEHOLDERS) {
    const idx = text.indexOf(ph);
    if (idx !== -1) {
      out.push(make('CONFIG003', { file: rel, line: lineOf(text, idx), excerpt: excerpt(text, idx) }, {
        detail: `Sample value ${ph} is still in place.`
      }));
      break;
    }
  }

  const saltIdx = text.indexOf('put your unique phrase here');
  if (saltIdx !== -1) {
    const hits = matches(text, /put your unique phrase here/g, 12);
    out.push(make('CONFIG004', { file: rel, line: hits[0].line, excerpt: hits[0].excerpt }, {
      detail: `${hits.length} salt constant(s) still hold the sample phrase.`
    }));
  }

  for (const name of ['WP_HOME', 'WP_SITEURL']) {
    const c = constant(name);
    if (c) out.push(make('CONFIG005', { file: rel, line: c.line, excerpt: c.excerpt }, { detail: `${name} is ${c.raw}.` }));
  }

  for (const name of ['DISALLOW_FILE_MODS', 'DISALLOW_FILE_EDIT']) {
    const c = constant(name);
    if (truthy(c)) out.push(make('CONFIG006', { file: rel, line: c.line, excerpt: c.excerpt }, { detail: `${name} is true.` }));
  }

  if (!constant('WP_MEMORY_LIMIT')) {
    out.push(make('CONFIG008', { file: rel }));
  }

  const prefix = text.match(/\$table_prefix\s*=\s*'([^']*)'/);
  if (prefix && prefix[1] === 'wp_') {
    out.push(make('CONFIG009', { file: rel, line: lineOf(text, prefix.index), excerpt: excerpt(text, prefix.index) }));
  }

  return out;
}
