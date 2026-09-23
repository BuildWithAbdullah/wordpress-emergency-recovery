import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { examplesDir, buildInstall, run, ids, manifest } from './helpers.mjs';

const { pairs } = manifest();

// Walked by hand rather than with the recursive readdir option, which only
// arrived in Node 18.17 and this suite runs on Node 18.
function countFiles(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
    else n += 1;
  }
  return n;
}

test('the manifest lists every pair directory on disk, and no others', () => {
  const onDisk = fs.readdirSync(examplesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== '_baseline')
    .map((e) => e.name)
    .sort();
  assert.deepEqual(pairs.map((p) => p.name).sort(), onDisk);
});

test('every pair has a fail side and a pass side with at least one file', () => {
  for (const p of pairs) {
    for (const side of ['fail', 'pass']) {
      const dir = path.join(examplesDir, p.name, side);
      assert.ok(fs.existsSync(dir), `${p.name}/${side} is missing`);
      assert.ok(countFiles(dir) > 0, `${p.name}/${side} is empty`);
    }
  }
});

for (const p of pairs) {
  test(`${p.name}: the failing install reports ${p.expect.fail.join(', ')}`, () => {
    const dir = buildInstall(path.join(examplesDir, p.name, 'fail'), p.name + '-fail');
    const found = ids(run(dir));
    for (const id of p.expect.fail) {
      assert.ok(found.includes(id), `expected ${id} in the failing install, got ${[...new Set(found)].join(', ')}`);
    }
  });

  test(`${p.name}: the corrected install does not report ${p.expect.fail.join(', ')}`, () => {
    const dir = buildInstall(path.join(examplesDir, p.name, 'pass'), p.name + '-pass');
    const found = ids(run(dir));
    const cleared = p.expect.fail.filter((id) => !p.expect.pass.includes(id));
    for (const id of cleared) {
      assert.ok(!found.includes(id), `${id} is still reported on the corrected side`);
    }
    for (const id of p.expect.pass) {
      assert.ok(found.includes(id), `expected ${id} to remain on the corrected side`);
    }
  });
}

test('the baseline install on its own reports nothing above medium', () => {
  const dir = buildInstall(null, 'baseline');
  const result = run(dir);
  const loud = result.findings.filter((f) => ['critical', 'high'].includes(f.severity));
  assert.deepEqual(loud.map((f) => `${f.id} ${f.evidence.file}`), [], 'the baseline is supposed to be a clean install');
});

// The cross-check. A corrected example that happens to carry a different
// defect is worse than no example at all, because it teaches the wrong thing.
test('no corrected install trips any other pair failing finding', () => {
  const every = new Set(pairs.flatMap((p) => p.expect.fail));
  for (const p of pairs) {
    const allowed = new Set(p.expect.pass);
    const dir = buildInstall(path.join(examplesDir, p.name, 'pass'), p.name + '-cross');
    const found = new Set(ids(run(dir)));
    for (const id of every) {
      if (allowed.has(id)) continue;
      assert.ok(!found.has(id), `${p.name}/pass trips ${id}, which belongs to another pair`);
    }
  }
});

test('every pair is listed in the examples README', () => {
  const readme = fs.readFileSync(path.join(examplesDir, 'README.md'), 'utf8');
  for (const p of pairs) {
    assert.ok(readme.includes(`\`${p.name}\``), `${p.name} is not in examples/README.md`);
  }
});
