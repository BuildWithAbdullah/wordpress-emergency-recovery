import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeInstall, run, ids, findingsFor } from './helpers.mjs';

const only = { only: ['updates'] };

test('a maintenance file is critical and its timestamp is decoded', () => {
  const r = run(makeInstall({ '.maintenance': '<?php $upgrading = 1758000000;\n' }, 'upd-maint'), only);
  const f = findingsFor(r, 'UPD001')[0];
  assert.equal(f.severity, 'critical');
  assert.match(f.detail, /2025-09-16T/);
});

test('a maintenance file with no timestamp is still reported', () => {
  const r = run(makeInstall({ '.maintenance': '<?php\n' }, 'upd-maint2'), only);
  assert.ok(ids(r).includes('UPD001'));
});

test('a non-empty upgrade directory is reported with the names inside it', () => {
  const r = run(makeInstall({ 'wp-content/upgrade/seo-plugin/seo.php': '<?php\n' }, 'upd-upgrade'), only);
  const f = findingsFor(r, 'UPD002')[0];
  assert.ok(f);
  assert.match(f.detail, /seo-plugin/);
});

test('a plugin directory with no PHP in it is reported as partially extracted', () => {
  const r = run(makeInstall({ 'wp-content/plugins/half-extracted/readme.txt': 'x\n' }, 'upd-partial'), only);
  assert.ok(ids(r).includes('UPD004'));
});

test('a plugin directory with PHP in it is not reported', () => {
  const r = run(makeInstall({ 'wp-content/plugins/fine/fine.php': '<?php\n' }, 'upd-fine'), only);
  assert.deepEqual(findingsFor(r, 'UPD004').map((f) => f.evidence.file), []);
});

test('core files written months apart are reported as version skew', () => {
  const dir = makeInstall({}, 'upd-skew');
  const old = Date.now() / 1000 - 400 * 86400;
  fs.utimesSync(path.join(dir, 'wp-includes/query.php'), old, old);
  const r = run(dir, only);
  const f = findingsFor(r, 'UPD003')[0];
  assert.ok(f);
  assert.match(f.detail, /span \d+ days/);
});

test('a baseline with consistent timestamps reports no skew', () => {
  assert.ok(!ids(run(makeInstall({}, 'upd-clean'), only)).includes('UPD003'));
});
