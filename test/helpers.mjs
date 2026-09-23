import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { triage } from '../src/triage.mjs';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const examplesDir = path.join(repoRoot, 'examples');

let counter = 0;
const created = [];

export function tempDir(label = 'wp') {
  counter += 1;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `wp-triage-${label}-${counter}-`));
  created.push(dir);
  return dir;
}

process.on('exit', () => {
  for (const dir of created) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

export function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

// Builds a throwaway install: the baseline, with an overlay copied over it.
export function buildInstall(overlayDir, label = 'case') {
  const dir = tempDir(label);
  copyTree(path.join(examplesDir, '_baseline'), dir);
  if (overlayDir) copyTree(overlayDir, dir);
  return dir;
}

// Builds an install from the baseline plus inline files, for cases that
// cannot be committed (file modes, huge files, byte order marks).
export function makeInstall(files = {}, label = 'inline') {
  const dir = buildInstall(null, label);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    if (content === null) { fs.rmSync(abs, { force: true }); continue; }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

export function run(dir, options = {}) {
  return triage(dir, options);
}

export function ids(result) {
  return result.findings.map((f) => f.id);
}

export function findingsFor(result, id) {
  return result.findings.filter((f) => f.id === id);
}

export function manifest() {
  return JSON.parse(fs.readFileSync(path.join(examplesDir, 'manifest.json'), 'utf8'));
}
