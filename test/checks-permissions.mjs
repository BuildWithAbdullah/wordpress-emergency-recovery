import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { makeInstall, run, ids, findingsFor } from './helpers.mjs';
import { octal } from '../src/checks/permissions.mjs';

const only = { only: ['permissions'] };
// File modes do not survive a git checkout, so these cases are built at
// runtime rather than committed as examples. On Windows the modes are not
// meaningful at all, so the mode cases are skipped there.
const modesMatter = os.platform() !== 'win32';

test('octal renders a mode the way chmod prints it', () => {
  assert.equal(octal(0o644), '0644');
  assert.equal(octal(0o777), '0777');
  assert.equal(octal(0o40755), '0755');
});

test('a tidy install reports nothing', { skip: !modesMatter }, () => {
  const dir = makeInstall({}, 'perm-clean');
  for (const rel of ['wp-config.php', 'index.php']) fs.chmodSync(path.join(dir, rel), 0o644);
  fs.chmodSync(path.join(dir, 'wp-content'), 0o755);
  assert.deepEqual(ids(run(dir, only)), []);
});

test('a group writable wp-config.php is critical', { skip: !modesMatter }, () => {
  const dir = makeInstall({}, 'perm-config');
  fs.chmodSync(path.join(dir, 'wp-config.php'), 0o664);
  const f = findingsFor(run(dir, only), 'PERM001')[0];
  assert.equal(f.severity, 'critical');
  assert.match(f.evidence.excerpt, /0664/);
});

test('a world writable directory is reported', { skip: !modesMatter }, () => {
  const dir = makeInstall({}, 'perm-dir');
  fs.chmodSync(path.join(dir, 'wp-content/uploads'), 0o777);
  const f = findingsFor(run(dir, only), 'PERM002')[0];
  assert.equal(f.evidence.file, 'wp-content/uploads');
});

test('a world writable file is reported at medium', { skip: !modesMatter }, () => {
  const dir = makeInstall({}, 'perm-file');
  fs.chmodSync(path.join(dir, 'wp-content/themes/sample-theme/functions.php'), 0o666);
  const f = findingsFor(run(dir, only), 'PERM003')[0];
  assert.equal(f.severity, 'medium');
});

test('wp-config.php is reported once, by its own rule, not twice', { skip: !modesMatter }, () => {
  const dir = makeInstall({}, 'perm-once');
  fs.chmodSync(path.join(dir, 'wp-config.php'), 0o666);
  const found = ids(run(dir, only));
  assert.ok(found.includes('PERM001'));
  assert.deepEqual(findingsFor(run(dir, only), 'PERM003').filter((f) => f.evidence.file === 'wp-config.php'), []);
});

test('an uploads directory the owner cannot write is reported at low', { skip: !modesMatter }, () => {
  const dir = makeInstall({}, 'perm-uploads');
  const uploads = path.join(dir, 'wp-content/uploads');
  fs.chmodSync(uploads, 0o555);
  const f = findingsFor(run(dir, only), 'PERM004')[0];
  fs.chmodSync(uploads, 0o755);
  assert.ok(f);
  assert.equal(f.severity, 'low');
});

test('the report is capped so a world writable tree cannot flood it', { skip: !modesMatter }, () => {
  const dir = makeInstall({}, 'perm-flood');
  const many = path.join(dir, 'wp-content/uploads');
  for (let i = 0; i < 40; i += 1) {
    const f = path.join(many, `f${i}.txt`);
    fs.writeFileSync(f, 'x');
    fs.chmodSync(f, 0o666);
  }
  assert.ok(findingsFor(run(dir, only), 'PERM003').length <= 25);
});
