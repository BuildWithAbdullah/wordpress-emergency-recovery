import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs, main, USAGE, listChecks, listFindings } from '../src/cli.mjs';
import { repoRoot, buildInstall, examplesDir, makeInstall } from './helpers.mjs';

function capture(argv) {
  const out = [];
  const err = [];
  const code = main(argv, { log: (s) => out.push(String(s)), error: (s) => err.push(String(s)) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

test('a path is required', () => {
  assert.throws(() => parseArgs([]), /path to the WordPress root is required/);
});

test('an unknown format is refused before any scanning happens', () => {
  assert.throws(() => parseArgs(['.', '--format', 'pdf']), /unknown format/);
});

test('an unknown severity is refused', () => {
  assert.throws(() => parseArgs(['.', '--fail-on', 'urgent']), /unknown severity/);
});

test('an unknown check is refused', () => {
  assert.throws(() => parseArgs(['.', '--only', 'config,nope']), /unknown check: nope/);
});

test('an unknown option is refused', () => {
  assert.throws(() => parseArgs(['.', '--deep']), /unknown option/);
});

test('a second path is refused rather than silently ignored', () => {
  assert.throws(() => parseArgs(['a', 'b']), /unexpected argument/);
});

test('options parse into the shape the runner expects', () => {
  const o = parseArgs(['/srv/site', '--format', 'json', '--only', 'config,logs', '--skip', 'core', '--fail-on', 'medium']);
  assert.equal(o.path, '/srv/site');
  assert.equal(o.format, 'json');
  assert.deepEqual(o.only, ['config', 'logs']);
  assert.deepEqual(o.skip, ['core']);
  assert.equal(o.failOn, 'medium');
});

test('help exits 0 and prints the usage', () => {
  const r = capture(['--help']);
  assert.equal(r.code, 0);
  assert.equal(r.out.trim(), USAGE.trim());
});

test('the check listing names every module', () => {
  const r = capture(['--list-checks']);
  assert.equal(r.code, 0);
  assert.equal(r.out, listChecks());
  for (const id of ['shape', 'config', 'logs', 'uploads', 'permissions']) assert.match(r.out, new RegExp(`^${id}\\s`, 'm'));
});

test('the finding listing names every catalogue entry', () => {
  const r = capture(['--list-findings']);
  assert.equal(r.code, 0);
  assert.equal(r.out, listFindings());
  assert.match(r.out, /^UPD001/m);
});

test('a bad option exits 2 and prints the usage to stderr', () => {
  const r = capture(['--wat']);
  assert.equal(r.code, 2);
  assert.match(r.err, /unknown option/);
  assert.match(r.err, /Exit codes/);
});

test('a path that does not exist exits 2', () => {
  const r = capture(['/no/such/place/at/all']);
  assert.equal(r.code, 2);
  assert.match(r.err, /not a directory/);
});

test('a failing install exits 1 and a quiet one exits 0', () => {
  const bad = buildInstall(path.join(examplesDir, 'uploads-php-shell', 'fail'), 'cli-bad');
  assert.equal(capture([bad]).code, 1);
  const ok = makeInstall({}, 'cli-ok');
  assert.equal(capture([ok]).code, 0);
});

test('the fail-on threshold changes the exit code without changing the report', () => {
  const dir = makeInstall({ 'wp-config.php': "<?php\n$table_prefix = 'wp_';\n" }, 'cli-threshold');
  assert.equal(capture([dir, '--only', 'config', '--fail-on', 'high']).code, 0);
  assert.equal(capture([dir, '--only', 'config', '--fail-on', 'info']).code, 1);
});

test('--only restricts the checks that run', () => {
  const dir = buildInstall(path.join(examplesDir, 'uploads-php-shell', 'fail'), 'cli-only');
  const r = capture([dir, '--only', 'config', '--format', 'json']);
  const parsed = JSON.parse(r.out);
  assert.deepEqual(parsed.checksRun, ['config']);
});

test('--skip removes a check and leaves the others', () => {
  const dir = makeInstall({}, 'cli-skip');
  const parsed = JSON.parse(capture([dir, '--skip', 'core,permissions', '--format', 'json']).out);
  assert.ok(!parsed.checksRun.includes('core'));
  assert.ok(parsed.checksRun.includes('config'));
});

test('the installed binary runs end to end and exits 1 on a failing install', () => {
  const dir = buildInstall(path.join(examplesDir, 'rogue-root-php', 'fail'), 'cli-bin');
  let code = 0;
  let stdout = '';
  try {
    stdout = execFileSync(process.execPath, [path.join(repoRoot, 'bin/wp-triage.mjs'), dir], { encoding: 'utf8' });
  } catch (err) {
    code = err.status;
    stdout = err.stdout;
  }
  assert.equal(code, 1);
  assert.match(stdout, /CORE001/);
});
