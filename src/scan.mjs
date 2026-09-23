// Builds a read-only view of an install.
//
// Everything a check module needs comes from here, and nothing here opens a
// socket, touches a database, or writes a byte. test/readonly.mjs asserts that
// by reading the source of every file under src/.

import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.svn', '.idea', 'vendor/bin']);

export const DEFAULT_LIMITS = {
  maxFiles: 60000,
  maxDepth: 12,
  maxTextBytes: 2 * 1024 * 1024
};

export function walk(root, limits = DEFAULT_LIMITS) {
  const out = [];
  let truncated = false;

  const visit = (dir, depth) => {
    if (truncated || depth > limits.maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= limits.maxFiles) { truncated = true; return; }
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        let st;
        try { st = fs.statSync(abs); } catch { continue; }
        out.push({ rel, abs, dir: true, size: 0, mode: st.mode & 0o7777, mtimeMs: st.mtimeMs });
        visit(abs, depth + 1);
      } else if (entry.isFile()) {
        let st;
        try { st = fs.statSync(abs); } catch { continue; }
        out.push({ rel, abs, dir: false, size: st.size, mode: st.mode & 0o7777, mtimeMs: st.mtimeMs });
      }
      // Symlinks are recorded as neither. wp-triage does not follow them,
      // because following one out of the install is how a read-only tool
      // stops being read-only in someone's incident report.
    }
  };

  visit(root, 0);
  return { files: out, truncated };
}

export function buildContext(root, limits = DEFAULT_LIMITS) {
  const abs = path.resolve(root);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    throw new Error(`not a directory: ${root}`);
  }
  const { files, truncated } = walk(abs, limits);
  const byRel = new Map(files.map((f) => [f.rel, f]));
  const cache = new Map();

  const readText = (rel) => {
    if (cache.has(rel)) return cache.get(rel);
    const entry = byRel.get(rel);
    let text = null;
    if (entry && !entry.dir && entry.size <= limits.maxTextBytes) {
      try { text = fs.readFileSync(entry.abs, 'utf8'); } catch { text = null; }
    }
    cache.set(rel, text);
    return text;
  };

  const readBytes = (rel, n) => {
    const entry = byRel.get(rel);
    if (!entry || entry.dir) return null;
    try {
      const fd = fs.openSync(entry.abs, 'r');
      const buf = Buffer.alloc(Math.min(n, entry.size));
      fs.readSync(fd, buf, 0, buf.length, 0);
      fs.closeSync(fd);
      return buf;
    } catch {
      return null;
    }
  };

  return {
    root: abs,
    files,
    truncated,
    limits,
    has: (rel) => byRel.has(rel),
    get: (rel) => byRel.get(rel) || null,
    isDir: (rel) => Boolean(byRel.get(rel)?.dir),
    readText,
    readBytes,
    phpFiles: () => files.filter((f) => !f.dir && /\.(php|phtml|php\d)$/i.test(f.rel)),
    under: (prefix) => files.filter((f) => f.rel === prefix || f.rel.startsWith(prefix + '/'))
  };
}

// Character index to 1-based line number.
export function lineOf(text, index) {
  if (index < 0) return 1;
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

// A short, safe excerpt. Long payload lines are truncated so a report
// never becomes a copy of the thing it is reporting.
export function excerpt(text, index, max = 120) {
  const start = text.lastIndexOf('\n', index) + 1;
  let end = text.indexOf('\n', index);
  if (end === -1) end = text.length;
  const raw = text.slice(start, end).trim();
  return raw.length > max ? raw.slice(0, max) + ' [truncated]' : raw;
}

// Every match of a regular expression, with line and excerpt attached.
export function matches(text, re, cap = 12) {
  const found = [];
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m;
  while ((m = rx.exec(text)) !== null && found.length < cap) {
    found.push({ index: m.index, match: m[0], groups: m.slice(1), line: lineOf(text, m.index), excerpt: excerpt(text, m.index) });
    if (m.index === rx.lastIndex) rx.lastIndex += 1;
  }
  return found;
}
