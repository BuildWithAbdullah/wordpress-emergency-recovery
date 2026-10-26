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

const BOM = '﻿';

// Reads the value of a define by walking the parentheses rather than by
// matching up to the first closing one. The common real form of
// WP_DEBUG_LOG puts a function call in the value, and a regular expression
// that stops at the first `)` captures half of it and then judges the half.
export function readConstant(text, name) {
  const opener = new RegExp(`define\\s*\\(\\s*(['"])${name}\\1\\s*,`, 'i');
  const m = text.match(opener);
  if (!m) return null;
  let i = m.index + m[0].length;
  let depth = 1;
  let quote = null;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) break;
    }
    i += 1;
  }
  // An unbalanced statement is reported as absent rather than guessed at.
  if (depth !== 0) return null;
  return {
    raw: text.slice(m.index + m[0].length, i).trim(),
    line: lineOf(text, m.index),
    excerpt: excerpt(text, m.index)
  };
}

const LITERAL_TRUE = /^(true|1|'1'|"1")$/i;
const LITERAL_FALSE = /^(false|0|'0'|"0"|null)$/i;

export function truthy(v) {
  return v !== null && LITERAL_TRUE.test(v.raw);
}

export function falsy(v) {
  return v !== null && LITERAL_FALSE.test(v.raw);
}

// A value that is neither literal is something only PHP can work out. The
// tool says so rather than treating it as off, which is what a half parsed
// value used to amount to.
export function literal(v) {
  return v !== null && (LITERAL_TRUE.test(v.raw) || LITERAL_FALSE.test(v.raw));
}

export function run(ctx) {
  const rel = 'wp-config.php';
  const text = ctx.readText(rel);
  if (text === null) return [];
  const out = [];

  const constant = (name) => readConstant(text, name);

  // Bytes before the opening tag. Checked first, because when this is wrong
  // nothing else about the file matters. A byte order mark on its own is left
  // to the output check, which names it exactly: reporting the same three
  // bytes here as well puts one span of a file in the queue twice under two
  // ids. The count is in bytes, because the mark is three of them and reading
  // the file as text turns it into one character.
  const openIdx = text.indexOf('<?php');
  if (openIdx > 0) {
    const before = text.slice(0, openIdx);
    if (before !== BOM) {
      out.push(make('CONFIG007', {
        file: rel,
        line: 1,
        excerpt: JSON.stringify(before.slice(0, 40))
      }, { detail: `${Buffer.byteLength(before, 'utf8')} byte(s) precede the opening tag.` }));
    }
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
  if (log && /wp-content|ABSPATH|__DIR__|__FILE__|^'?\.\//.test(log.raw)) {
    out.push(make('CONFIG002', { file: rel, line: log.line, excerpt: log.excerpt }, {
      detail: `WP_DEBUG_LOG is ${log.raw}, which resolves inside the install.`
    }));
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

  // Two constants that are routinely confused for each other. MODS stops
  // every update and install; EDIT only hides two admin screens. A responder
  // chasing an update that will not run needs to know which one is set, so
  // they are separate findings rather than one with a different detail line.
  const mods = constant('DISALLOW_FILE_MODS');
  if (truthy(mods)) {
    out.push(make('CONFIG006', { file: rel, line: mods.line, excerpt: mods.excerpt }, {
      detail: 'DISALLOW_FILE_MODS is true, so plugin, theme and core updates are all blocked.'
    }));
  }
  const fileEdit = constant('DISALLOW_FILE_EDIT');
  if (truthy(fileEdit)) {
    out.push(make('CONFIG010', { file: rel, line: fileEdit.line, excerpt: fileEdit.excerpt }, {
      detail: 'DISALLOW_FILE_EDIT is true, which removes the theme and plugin editor screens only.'
    }));
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
