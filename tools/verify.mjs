#!/usr/bin/env node
// Assertions about the repository itself rather than about the code.
// Run with `npm run verify`. CI runs it on every push.
//
// The rule these have accumulated around: a number printed in the README has
// to be produced by the code that the number is about, and compared against
// the file as a whole line. A count checked with a pattern passes when the
// line it lives on has been reflowed and the number has moved.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CATALOGUE } from '../src/findings.mjs';
import { CHECKS } from '../src/checks/index.mjs';
import { LIMITS } from '../src/limits.mjs';
import { FIXTURES } from '../test/corpus.mjs';
import { countTests, testFiles } from './count-tests.mjs';
import { trackedFiles } from './tracked.mjs';

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

const read = (p) => fs.readFileSync(path.join(repoRoot, p), 'utf8');
const tracked = trackedFiles(repoRoot);
const textFiles = tracked.filter((p) => /\.(md|mjs|json|ya?ml|php|css|txt|log)$/.test(p) || /(^|\/)\.htaccess$/.test(p) || /(^|\/)\.maintenance$/.test(p) || p === '.gitignore');

// ---- house style ---------------------------------------------------------
// The patterns are built from character codes and fragments so that this file
// does not fail its own checks by containing the strings it looks for. It is
// still scanned like every other file.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);
const UNIVERSITY = new RegExp(['FAST', '-?', 'NUCES', '|', 'National University of Comp', 'uter'].join(''), 'i');

for (const file of textFiles) {
  const text = read(file);
  check(!text.includes(EM_DASH), `${file} contains an em dash`);
  check(!text.includes(EN_DASH), `${file} contains an en dash`);
  check(!UNIVERSITY.test(text), `${file} names a university`);
  check(!/\t \t/.test(text), `${file} has mixed indentation`);
}

// The tracked file list is what every count below is about, so it is checked
// against git itself wherever git is available. A hand written gitignore
// matcher that disagrees with the real one is worse than no matcher.
if (fs.existsSync(path.join(repoRoot, '.git'))) {
  const git = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  if (git.status === 0) {
    const fromGit = git.stdout.split('\n').map((l) => l.trim()).filter(Boolean).sort();
    check(
      JSON.stringify(fromGit) === JSON.stringify([...tracked].sort()),
      `tools/tracked.mjs disagrees with git: ${fromGit.length} files from git, ${tracked.length} from the tool`
    );
  }
}

// ---- the README keeps its promises --------------------------------------
const readme = read('README.md');
for (const section of ['## Verifying', '## What it does not tell you', '## Examples', '## Usage', '## The fixture corpus']) {
  check(readme.includes(section), `README is missing the ${section} section`);
}
check(readme.includes('MIT'), 'README does not state the licence');

const catalogueCount = Object.keys(CATALOGUE).length;
const checkCount = CHECKS.length;
const stated = readme.match(/(\d+)\s+findings across\s+(\d+)\s+check modules/);
check(Boolean(stated), 'README does not state the finding and check counts in the expected form');
if (stated) {
  check(Number(stated[1]) === catalogueCount, `README says ${stated[1]} findings, the catalogue has ${catalogueCount}`);
  check(Number(stated[2]) === checkCount, `README says ${stated[2]} check modules, there are ${checkCount}`);
}

for (const c of CHECKS) {
  check(readme.includes(`\`${c.id}\``), `README does not mention the ${c.id} check`);
}

// A number is matched as a whole line, so a reflowed paragraph that splits it
// across a line break fails here rather than passing with the count missing.
function statedOnOneLine(text, re, label) {
  const hits = text.split('\n').map((line) => line.match(re)).filter(Boolean);
  check(hits.length === 1, `${label} should appear on exactly one line, found ${hits.length}`);
  return hits.length === 1 ? hits[0] : null;
}

// ---- one entry per reason, and a fixture for every one of them ----------
check(FIXTURES.length === catalogueCount, `${FIXTURES.length} fixtures for ${catalogueCount} catalogued findings`);
const fixtureIds = new Set(FIXTURES.map((f) => f.id));
for (const id of Object.keys(CATALOGUE)) {
  check(fixtureIds.has(id), `${id} has no fixture of its own in test/corpus.mjs`);
}
const reachedByFixtures = new Set(FIXTURES.flatMap((f) => f.expect));
for (const id of Object.keys(CATALOGUE)) {
  check(reachedByFixtures.has(id), `${id} is not produced by any fixture`);
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

// ---- the limits are assertions, not a paragraph -------------------------
const limitsDoc = read('docs/limits.md');
const limitsTest = read('test/limits.mjs');
check(LIMITS.length >= 7, `expected at least 7 declared limits, found ${LIMITS.length}`);
for (const l of LIMITS) {
  check(limitsDoc.includes(l.id), `${l.id} is not named in docs/limits.md`);
  check(limitsTest.includes(l.id), `${l.id} has no test in test/limits.mjs`);
  check(l.bothWays === true, `${l.id} is not asserted in both directions`);
  check(l.text.length > 120, `${l.id} needs a real explanation rather than a label`);
}
const limitLine = statedOnOneLine(readme, /^.*\b(\d+) declared limits\b.*$/, 'the declared limit count');
if (limitLine) check(Number(limitLine[1]) === LIMITS.length, `README says ${limitLine[1]} limits, there are ${LIMITS.length}`);

// ---- every internal link resolves ---------------------------------------
for (const file of tracked.filter((p) => p.endsWith('.md'))) {
  const text = read(file);
  for (const m of text.matchAll(/\]\(([^)#:]+?)(?:#[^)]*)?\)/g)) {
    const target = m[1].trim();
    if (/^(https?|mailto):/.test(target)) continue;
    const resolved = path.resolve(path.dirname(path.join(repoRoot, file)), target);
    check(fs.existsSync(resolved), `${file} links to ${target}, which does not exist`);
  }
}

// ---- examples ------------------------------------------------------------
const manifest = JSON.parse(read('examples/manifest.json'));
check(manifest.pairs.length >= 12, `expected at least 12 example pairs, found ${manifest.pairs.length}`);
for (const p of manifest.pairs) {
  for (const side of ['fail', 'pass']) {
    check(fs.existsSync(path.join(repoRoot, 'examples', p.name, side)), `examples/${p.name}/${side} is missing`);
  }
  check(Array.isArray(p.expect.residual), `examples/${p.name} declares no residual set`);
  for (const id of [...p.expect.fail, ...p.expect.residual]) {
    check(Boolean(CATALOGUE[id]), `examples/${p.name} expects ${id}, which is not in the catalogue`);
  }
  const cleared = p.expect.fail.filter((id) => !p.expect.residual.includes(id));
  check(cleared.length > 0, `examples/${p.name} corrects nothing`);
}

// The honest number: how much of the catalogue the readable half of the
// evidence actually reaches.
const byPairs = new Set(manifest.pairs.flatMap((p) => [...p.expect.fail, ...p.expect.residual]));
const pairsLine = statedOnOneLine(readme, /^.*\b(\d+) of the (\d+) catalogued findings\b.*$/, 'the pair coverage claim');
if (pairsLine) {
  check(Number(pairsLine[1]) === byPairs.size, `README says the pairs reach ${pairsLine[1]}, they reach ${byPairs.size}`);
  check(Number(pairsLine[2]) === catalogueCount, `README says ${pairsLine[2]} catalogued findings, there are ${catalogueCount}`);
}

// Fixtures shaped like malware have to be inert, and the check is mechanical
// rather than a promise in a comment.
for (const file of tracked.filter((p) => p.startsWith('examples/') && p.endsWith('.php'))) {
  const text = read(file);
  const flagged = /eval\s*\(|create_function|preg_replace\s*\([^)]*\/e|system\s*\(|passthru\s*\(|shell_exec/.test(text);
  if (!flagged) continue;
  check(/^<\?php\s*\n\s*exit\s*;/.test(text), `${file} carries a flagged pattern but does not exit on its first statement`);
}

// ---- package.json --------------------------------------------------------
const pkg = JSON.parse(read('package.json'));
check(pkg.license === 'MIT', 'package.json is not MIT licensed');
check(Object.keys(pkg.dependencies || {}).length === 0, 'wp-triage is supposed to have no dependencies');
check(pkg.type === 'module', 'package.json should declare type module');

// An engines floor has to be an exact version. A bare major is not a tested
// promise, because actions/setup-node resolves a job named '20' to the newest
// release of that line, and the floor is the oldest.
const floor = (pkg.engines?.node || '').match(/^>=\s*(\d+)\.(\d+)\.(\d+)$/);
check(Boolean(floor), `engines.node should be >= an exact three part version, it is ${pkg.engines?.node}`);

const testScriptFiles = testFiles(repoRoot).map((p) => 'test/' + path.basename(p));
check(!pkg.scripts.test.includes('*'), 'the test script uses a glob, which is resolved by the shell rather than by node');
for (const f of testScriptFiles) {
  check(pkg.scripts.test.includes(f), `${f} is not named in the test script, so it never runs`);
}
const namedInScript = (pkg.scripts.test.match(/test\/[\w-]+\.mjs/g) || []);
for (const f of namedInScript) {
  check(testScriptFiles.includes(f), `the test script names ${f}, which is not a test file`);
}

// ---- continuous integration ---------------------------------------------
const ci = read('.github/workflows/ci.yml');
if (floor) {
  const exact = `${floor[1]}.${floor[2]}.${floor[3]}`;
  check(ci.includes(`'${exact}'`), `CI does not run on the engines floor ${exact} exactly`);
  check(!new RegExp(`node(-version)?:?\\s*\\[?[^\\n]*'${floor[1]}'`).test(ci),
    `CI names Node '${floor[1]}' bare, which resolves to the newest release of that line rather than the floor`);
}
// npm writes a banner to stdout, so a step that redirects `npm run` into a
// file captures the banner along with the output and a generated file check
// then compares the wrong bytes.
//
// One assertion over the whole file rather than one per line, deliberately.
// Per line, the assertion total moved every time the workflow was edited,
// which made the self referential count in the README a count of how long
// the CI file is. Found by running the published clone's own verifier against
// a README written from the working copy.
const redirected = ci.split('\n').filter((line) => /npm run [\w:-]+\s*>/.test(line));
check(redirected.length === 0, `CI steps that redirect an npm run: ${redirected.map((l) => l.trim()).join(' | ')}`);

// ---- the counts the README prints ---------------------------------------
const { pass, fail } = await countTests(repoRoot);
check(fail === 0, `${fail} test(s) failed`);
const readmeTests = statedOnOneLine(readme, /^.*\bnpm test\b.*?#\s*(\d+) tests\b.*$/, 'the test count');
if (readmeTests) check(Number(readmeTests[1]) === pass, `README says ${readmeTests[1]} tests, ${pass} pass`);

const readmeFiles = statedOnOneLine(readme, /^.*\b(\d+) tracked files\b.*$/, 'the tracked file count');
if (readmeFiles) check(Number(readmeFiles[1]) === tracked.length, `README says ${readmeFiles[1]} tracked files, there are ${tracked.length}`);

const readmeFixtures = statedOnOneLine(readme, /^.*\b(\d+) fixtures\b.*$/, 'the fixture count');
if (readmeFixtures) check(Number(readmeFixtures[1]) === FIXTURES.length, `README says ${readmeFixtures[1]} fixtures, there are ${FIXTURES.length}`);

// ---- every source file parses on the Node in use ------------------------
for (const file of tracked.filter((p) => p.startsWith('src/') && p.endsWith('.mjs'))) {
  try {
    await import(path.join(repoRoot, file));
  } catch (err) {
    check(false, `${file} failed to load: ${err.message}`);
  }
}

// ---- the assertion count includes this comparison -----------------------
// Counted last, and the count below is one more than the number of checks
// above it, because this is a check too.
const readmeAssertions = statedOnOneLine(readme, /^.*\b(\d+) repository assertions\b.*$/, 'the assertion count');
if (readmeAssertions) {
  check(Number(readmeAssertions[1]) === assertions + 1, `README says ${readmeAssertions[1]} repository assertions, this run made ${assertions + 1}`);
}

console.log(`${assertions} assertions, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
