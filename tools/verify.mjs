#!/usr/bin/env node
// Assertions about the repository itself rather than about the code.
// Run with `npm run verify`. CI runs it on every push.

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATALOGUE } from '../src/findings.mjs';
import { CHECKS } from '../src/checks/index.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
let assertions = 0;

function check(ok, message) {
  assertions += 1;
  if (!ok) {
    failures += 1;
    console.error(`FAIL  ${message}`);
  }
}

function allFiles(dir, filter = () => true) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (filter(p)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

const rel = (p) => path.relative(repoRoot, p);
const read = (p) => fs.readFileSync(path.join(repoRoot, p), 'utf8');

// ---- house style ---------------------------------------------------------
// The patterns are built from character codes and fragments so that this file
// does not fail its own checks by containing the strings it looks for. It is
// still scanned like every other file.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);
const UNIVERSITY = new RegExp(['FAST', '-?', 'NUCES', '|', 'National University of Comp', 'uter'].join(''), 'i');

const textFiles = allFiles(repoRoot, (p) => /\.(md|mjs|json|ya?ml|php|css|txt)$/.test(p) || /\.htaccess$/.test(p));
for (const file of textFiles) {
  const text = fs.readFileSync(file, 'utf8');
  check(!text.includes(EM_DASH), `${rel(file)} contains an em dash`);
  check(!text.includes(EN_DASH), `${rel(file)} contains an en dash`);
  check(!UNIVERSITY.test(text), `${rel(file)} names a university`);
  check(!/\t \t/.test(text), `${rel(file)} has mixed indentation`);
}

// ---- the README keeps its promises --------------------------------------
const readme = read('README.md');
for (const section of ['## Verifying', '## What it does not tell you', '## Examples', '## Usage']) {
  check(readme.includes(section), `README is missing the ${section} section`);
}
check(readme.includes('MIT'), 'README does not state the licence');

// The counts printed in the README have to be the counts the code produces,
// or the README rots the first time a check is added.
const catalogueCount = Object.keys(CATALOGUE).length;
const checkCount = CHECKS.length;
const stated = readme.match(/(\d+)\s+findings across\s+(\d+)\s+check modules/);
check(Boolean(stated), 'README does not state the finding and check counts in the expected form');
if (stated) {
  check(Number(stated[1]) === catalogueCount, `README says ${stated[1]} findings, the catalogue has ${catalogueCount}`);
  check(Number(stated[2]) === checkCount, `README says ${stated[2]} check modules, there are ${checkCount}`);
}

// Every check module named in the README exists, and every module is named.
for (const c of CHECKS) {
  check(readme.includes(`\`${c.id}\``), `README does not mention the ${c.id} check`);
}

// ---- docs ----------------------------------------------------------------
const symptomDir = path.join(repoRoot, 'docs/symptoms');
const symptoms = fs.readdirSync(symptomDir).filter((f) => f.endsWith('.md'));
check(symptoms.length >= 8, `expected at least 8 symptom pages, found ${symptoms.length}`);
for (const f of symptoms) {
  const text = fs.readFileSync(path.join(symptomDir, f), 'utf8');
  check(/^#\s+\S/m.test(text), `docs/symptoms/${f} has no heading`);
  check(/does not cover/i.test(text), `docs/symptoms/${f} does not say what it does not cover`);
  check(text.split(/\s+/).length > 250, `docs/symptoms/${f} is too thin to be useful`);
  check(readme.includes(f), `docs/symptoms/${f} is not linked from the README`);
}
for (const f of ['docs/before-you-touch-anything.md', 'docs/recovery-log-template.md', 'docs/limits.md']) {
  check(fs.existsSync(path.join(repoRoot, f)), `${f} is missing`);
  check(readme.includes(path.basename(f)), `${f} is not linked from the README`);
}

// ---- every internal link resolves ---------------------------------------
for (const file of allFiles(repoRoot, (p) => p.endsWith('.md'))) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/\]\(([^)#:]+?)(?:#[^)]*)?\)/g)) {
    const target = m[1].trim();
    if (/^(https?|mailto):/.test(target)) continue;
    const resolved = path.resolve(path.dirname(file), target);
    check(fs.existsSync(resolved), `${rel(file)} links to ${target}, which does not exist`);
  }
}

// ---- examples ------------------------------------------------------------
const manifest = JSON.parse(read('examples/manifest.json'));
check(manifest.pairs.length >= 8, `expected at least 8 example pairs, found ${manifest.pairs.length}`);
for (const p of manifest.pairs) {
  for (const side of ['fail', 'pass']) {
    check(fs.existsSync(path.join(repoRoot, 'examples', p.name, side)), `examples/${p.name}/${side} is missing`);
  }
  for (const id of p.expect.fail) {
    check(Boolean(CATALOGUE[id]), `examples/${p.name} expects ${id}, which is not in the catalogue`);
  }
}

// Fixtures shaped like malware have to be inert, and the check is mechanical
// rather than a promise in a comment.
for (const file of allFiles(path.join(repoRoot, 'examples'), (p) => p.endsWith('.php'))) {
  const text = fs.readFileSync(file, 'utf8');
  const flagged = /eval\s*\(|create_function|preg_replace\s*\([^)]*\/e|system\s*\(|passthru\s*\(|shell_exec/.test(text);
  if (!flagged) continue;
  const head = text.slice(0, text.indexOf('\n', text.indexOf('exit')) + 1);
  check(/^<\?php\s*\n\s*exit\s*;/.test(text), `${rel(file)} carries a flagged pattern but does not exit on its first statement`);
  check(head.length > 0, `${rel(file)} has no exit at the top`);
}

// ---- package.json --------------------------------------------------------
const pkg = JSON.parse(read('package.json'));
check(pkg.license === 'MIT', 'package.json is not MIT licensed');
check(Object.keys(pkg.dependencies || {}).length === 0, 'wp-triage is supposed to have no dependencies');
check(pkg.type === 'module', 'package.json should declare type module');

// `node --test` did not accept glob patterns before Node 21, so the test
// script names every file, and this is the assertion that it keeps doing so.
const testDir = path.join(repoRoot, 'test');
const testFiles = fs.readdirSync(testDir).filter((f) => f.endsWith('.mjs') && f !== 'helpers.mjs');
check(!pkg.scripts.test.includes('*'), 'the test script uses a glob, which fails on Node 18 and 20');
for (const f of testFiles) {
  check(pkg.scripts.test.includes(`test/${f}`), `test/${f} is not named in the test script, so it never runs`);
}

// The test count printed in the README has to be the number of tests that
// actually run, not a number somebody typed. Cases generated inside a loop
// mean it cannot be counted by reading the files, so the suite is run and its
// own tally is read back. It costs a few seconds and it keeps the README true.
const tally = spawnSync(process.execPath, ['--test', ...testFiles.map((f) => `test/${f}`)], {
  cwd: repoRoot,
  encoding: 'utf8'
});
const ran = (tally.stdout || '').match(/^# pass (\d+)/m);
check(Boolean(ran), 'could not read the test tally back from the test runner');
const readmeTests = readme.match(/npm test\s+#\s+(\d+) tests/);
check(Boolean(readmeTests), 'README does not state the test count beside npm test');
if (ran && readmeTests) {
  check(Number(readmeTests[1]) === Number(ran[1]), `README says ${readmeTests[1]} tests, ${ran[1]} pass`);
}

// ---- every source file parses on the Node in use ------------------------
for (const file of allFiles(path.join(repoRoot, 'src'), (p) => p.endsWith('.mjs'))) {
  try {
    await import(file);
  } catch (err) {
    check(false, `${rel(file)} failed to load: ${err.message}`);
  }
}

console.log(`${assertions} assertions, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
