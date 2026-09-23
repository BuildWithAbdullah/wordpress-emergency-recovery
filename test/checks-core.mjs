import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeInstall, run, ids, findingsFor } from './helpers.mjs';
import { ROOT_PHP } from '../src/checks/core.mjs';

const only = { only: ['core'] };

test('a PHP file at the root that core does not ship is reported', () => {
  const r = run(makeInstall({ 'wp-login-backup.php': '<?php\n' }, 'core-root'), only);
  const f = findingsFor(r, 'CORE001')[0];
  assert.equal(f.evidence.file, 'wp-login-backup.php');
});

test('the stock root files are not reported', () => {
  const files = Object.fromEntries([...ROOT_PHP].map((n) => [n, '<?php\n']));
  const r = run(makeInstall(files, 'core-stock'), only);
  assert.deepEqual(findingsFor(r, 'CORE001'), []);
});

test('a non-PHP file at the root is not reported by this rule', () => {
  const r = run(makeInstall({ 'robots.txt': 'User-agent: *\n' }, 'core-robots'), only);
  assert.deepEqual(findingsFor(r, 'CORE001'), []);
});

test('a file with an extension core never ships inside wp-includes is critical', () => {
  const r = run(makeInstall({ 'wp-includes/backup.zip': 'x' }, 'core-zip'), only);
  assert.equal(findingsFor(r, 'CORE002')[0].severity, 'critical');
});

test('ordinary core file types inside wp-includes are not reported', () => {
  const r = run(makeInstall({ 'wp-includes/blocks.json': '{}\n', 'wp-includes/css/dashicons.css': 'a{}\n' }, 'core-ok'), only);
  assert.deepEqual(findingsFor(r, 'CORE002'), []);
});

test('a core file written far from the rest of core is reported', () => {
  const dir = makeInstall({}, 'core-skew');
  const when = Date.now() / 1000 - 200 * 86400;
  fs.utimesSync(path.join(dir, 'wp-includes/plugin.php'), when, when);
  const f = findingsFor(run(dir, only), 'CORE003')[0];
  assert.ok(f);
  assert.equal(f.evidence.file, 'wp-includes/plugin.php');
  assert.match(f.detail, /day\(s\) from the median/);
});

test('a core file newer than version.php is reported', () => {
  const dir = makeInstall({}, 'core-newer');
  const when = Date.now() / 1000 + 10 * 86400;
  fs.utimesSync(path.join(dir, 'wp-admin/admin.php'), when, when);
  assert.ok(ids(run(dir, only)).includes('CORE004'));
});

test('a baseline with consistent timestamps reports nothing', () => {
  assert.deepEqual(ids(run(makeInstall({}, 'core-clean'), only)), []);
});

test('the root file list matches the count a WordPress release ships', () => {
  assert.equal(ROOT_PHP.size, 15);
  assert.ok(ROOT_PHP.has('xmlrpc.php'));
  assert.ok(!ROOT_PHP.has('wp-admin.php'));
});
