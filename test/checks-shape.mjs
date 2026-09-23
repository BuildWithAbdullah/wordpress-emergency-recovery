import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeInstall, run, ids, tempDir } from './helpers.mjs';

test('a clean baseline reports only the version, at info', () => {
  const found = run(makeInstall({}, 'shape-clean'), { only: ['shape'] });
  assert.deepEqual(ids(found), ['SHAPE005']);
  assert.equal(found.findings[0].detail, 'Reported version 6.7.1.');
});

test('a missing wp-config.php is critical', () => {
  const found = ids(run(makeInstall({ 'wp-config.php': null }, 'shape-noconfig'), { only: ['shape'] }));
  assert.ok(found.includes('SHAPE001'));
});

test('a missing version.php is critical', () => {
  const found = ids(run(makeInstall({ 'wp-includes/version.php': null }, 'shape-nover'), { only: ['shape'] }));
  assert.ok(found.includes('SHAPE002'));
  assert.ok(!found.includes('SHAPE005'), 'no version can be reported when the file is gone');
});

test('a missing wp-content is reported', () => {
  const dir = makeInstall({}, 'shape-nocontent');
  fs.rmSync(path.join(dir, 'wp-content'), { recursive: true, force: true });
  assert.ok(ids(run(dir, { only: ['shape'] })).includes('SHAPE003'));
});

test('an index.php that does not load the blog header is reported with a line', () => {
  const result = run(makeInstall({ 'index.php': "<?php\nrequire __DIR__ . '/loader.php';\n" }, 'shape-index'), { only: ['shape'] });
  const f = result.findings.find((x) => x.id === 'SHAPE004');
  assert.ok(f);
  assert.equal(f.evidence.file, 'index.php');
  assert.equal(f.evidence.line, 2);
});

test('a path that is not a directory is an error, not a finding', () => {
  const dir = tempDir('shape-file');
  const file = path.join(dir, 'a.txt');
  fs.writeFileSync(file, 'x');
  assert.throws(() => run(file), /not a directory/);
});
