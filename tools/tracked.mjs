#!/usr/bin/env node
// Enumerates the files git would track, so a count printed in the README is
// a count of the repository rather than of whatever is lying around.
//
// Two things make this worth having rather than walking the tree. The
// engine-strict job in CI runs npm install, which writes a lock file even
// for a package with no dependencies, so a naive count disagrees with the
// README on CI and nowhere else. And this repository needs a negated ignore
// rule, because one example pair is about a debug log in the web root and
// that log has to be committed while every other log stays ignored.
//
// The rules are read from .gitignore rather than shelled out to git, so this
// works in a tree that was copied rather than cloned. Where .git is present
// the suite checks the answer against git ls-files, which is the only way to
// know a hand written matcher agrees with the real one.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const ALWAYS = ['.git', 'node_modules'];

// A gitignore pattern as a regular expression over the path relative to the
// repository root. Only the subset gitignore actually uses here: a leading
// bang to negate, a trailing slash for directories only, a slash anywhere
// but the end to anchor, ** for any number of path segments and * for part
// of one segment.
export function compile(pattern) {
  let body = pattern;
  const negated = body.startsWith('!');
  if (negated) body = body.slice(1);
  const dirOnly = body.endsWith('/');
  if (dirOnly) body = body.slice(0, -1);
  const anchored = body.includes('/');
  if (body.startsWith('/')) body = body.slice(1);

  let source = '';
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '*' && body[i + 1] === '*') {
      // A ** between slashes also matches no segment at all.
      if (body[i + 2] === '/') { source += '(?:.*/)?'; i += 2; } else { source += '.*'; i += 1; }
    } else if (ch === '*') {
      source += '[^/]*';
    } else if (ch === '?') {
      source += '[^/]';
    } else {
      source += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }

  return { re: new RegExp(`^${source}$`), negated, dirOnly, anchored, pattern };
}

export function ignoreRules(root = repoRoot) {
  const file = path.join(root, '.gitignore');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))
    .map(compile);
}

// Last matching rule wins, which is what git does and the only reason a
// negation can override the rule above it.
export function isIgnored(rel, isDir, rules) {
  const base = rel.split('/').pop();
  let verdict = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    const subject = rule.anchored ? rel : base;
    if (rule.re.test(subject)) verdict = !rule.negated;
  }
  return verdict;
}

export function trackedFiles(root = repoRoot, filter = () => true) {
  const rules = ignoreRules(root);
  const out = [];
  const walk = (dir, prefix) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const entry of entries) {
      if (ALWAYS.includes(entry.name)) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        // A directory is only skipped outright when nothing inside it could
        // be brought back by a negation.
        if (isIgnored(rel, true, rules) && !rules.some((r) => r.negated)) continue;
        walk(path.join(dir, entry.name), rel);
      } else if (entry.isFile() && !isIgnored(rel, false, rules) && filter(rel)) {
        out.push(rel);
      }
    }
  };
  walk(root, '');
  return out;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = trackedFiles();
  process.stderr.write(`${files.length} tracked files\n`);
  process.stdout.write(files.join('\n') + '\n');
}
