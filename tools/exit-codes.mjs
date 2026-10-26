#!/usr/bin/env node
// Runs the real command line tool over every example pair and checks the
// exit code against the one the manifest implies.
//
// The suite asserts which findings each side of a pair reports. This asserts
// that the process a pipeline would actually run agrees, in both formats and
// in both directions, which is a different claim: a tool whose library is
// right and whose exit code is wrong is broken for every use that matters.
//
// The expected code comes from the manifest and the severity table rather
// than from a list kept here, so a pair whose severity changes cannot leave a
// stale expectation behind.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CATALOGUE, severityRank } from '../src/findings.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const examplesDir = path.join(repoRoot, 'examples');
const FAIL_ON = 'high';

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

function install(overlay) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-triage-exit-'));
  copyTree(path.join(examplesDir, '_baseline'), dir);
  if (overlay) copyTree(overlay, dir);
  return dir;
}

function expectedCode(ids) {
  const limit = severityRank(FAIL_ON);
  return ids.some((id) => severityRank(CATALOGUE[id].severity) <= limit) ? 1 : 0;
}

function runCli(args) {
  const r = spawnSync(process.execPath, [path.join(repoRoot, 'bin/wp-triage.mjs'), ...args], {
    encoding: 'utf8'
  });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}

const manifest = JSON.parse(fs.readFileSync(path.join(examplesDir, 'manifest.json'), 'utf8'));
let failures = 0;
const report = (ok, message) => {
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'}  ${message}\n`);
};

// The clean baseline first, because every pair is built on it.
{
  const dir = install(null);
  for (const format of ['text', 'markdown', 'json']) {
    const { code, out } = runCli([dir, '--format', format]);
    report(code === 0, `baseline exits 0 in ${format} format (got ${code})`);
    report(out.length > 80, `baseline renders something in ${format} format`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

for (const pair of manifest.pairs) {
  for (const [side, ids] of [['fail', pair.expect.fail], ['pass', pair.expect.residual]]) {
    const want = expectedCode(ids);
    const dir = install(path.join(examplesDir, pair.name, side));
    const { code, out } = runCli([dir, '--format', 'markdown']);
    report(code === want, `${pair.name}/${side} exits ${want} (got ${code})`);
    for (const id of ids) {
      report(out.includes(id), `${pair.name}/${side} names ${id} in the report`);
    }
    // A failing side whose worst finding is below the default threshold
    // exits 0, which is correct and is also the thing somebody will be
    // surprised by. So the lower threshold is asserted to catch it, and the
    // default is asserted not to.
    if (side === 'fail' && want === 0) {
      const lower = runCli([dir, '--format', 'markdown', '--fail-on', 'medium']);
      report(lower.code === 1, `${pair.name}/fail exits 1 at --fail-on medium (got ${lower.code})`);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// And the refusals, which are the codes a pipeline reads to tell a broken
// run from a clean one.
{
  const missing = runCli(['/no/such/path']);
  report(missing.code === 2, `a path that does not exist exits 2 (got ${missing.code})`);
  const badFormat = runCli([repoRoot, '--format', 'yaml']);
  report(badFormat.code === 2, `an unknown format exits 2 (got ${badFormat.code})`);
  const badCheck = runCli([repoRoot, '--only', 'nonsense']);
  report(badCheck.code === 2, `an unknown check exits 2 (got ${badCheck.code})`);
  const help = runCli(['--help']);
  report(help.code === 0, `--help exits 0 (got ${help.code})`);
}

process.stdout.write(`${failures} failed\n`);
process.exit(failures === 0 ? 0 : 1);
