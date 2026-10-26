import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CATALOGUE } from '../src/findings.mjs';
import { examplesDir, buildInstall, run, ids, manifest } from './helpers.mjs';

const { pairs } = manifest();

const set = (list) => [...new Set(list)].sort();

// Walked by hand rather than with the recursive readdir option, because the
// recursive form returns directories as well and this wants a file count.
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

test('every id either side of a pair is in the catalogue', () => {
  for (const p of pairs) {
    for (const id of [...p.expect.fail, ...p.expect.residual]) {
      assert.ok(CATALOGUE[id], `${p.name} names ${id}, which is not in the catalogue`);
    }
  }
});

// Set equality, not inclusion. A pair that trips a finding it does not
// declare is as wrong as one that misses a finding it does, because the
// undeclared one is the half nobody reviewed.
for (const p of pairs) {
  test(`${p.name}: the failing install reports exactly ${p.expect.fail.join(', ')}`, () => {
    const dir = buildInstall(path.join(examplesDir, p.name, 'fail'), p.name + '-fail');
    assert.deepEqual(set(ids(run(dir))), set(p.expect.fail));
  });

  // The residual set: what the repair layer cannot clear, asserted in both
  // directions. Everything the failing side reported is gone unless it is in
  // the residual set, and everything in the residual set is still there.
  test(`${p.name}: the corrected install reports exactly ${p.expect.residual.join(', ')}`, () => {
    const dir = buildInstall(path.join(examplesDir, p.name, 'pass'), p.name + '-pass');
    const found = set(ids(run(dir)));
    assert.deepEqual(found, set(p.expect.residual));
    const cleared = p.expect.fail.filter((id) => !p.expect.residual.includes(id));
    assert.ok(cleared.length > 0, `${p.name} corrects nothing`);
    for (const id of cleared) assert.ok(!found.includes(id), `${id} survived the correction`);
    for (const id of p.expect.residual) assert.ok(found.includes(id), `${id} is declared residual but is absent`);
  });
}

test('the baseline install on its own reports nothing above medium', () => {
  const dir = buildInstall(null, 'baseline');
  const result = run(dir);
  const loud = result.findings.filter((f) => ['critical', 'high'].includes(f.severity));
  assert.deepEqual(loud.map((f) => `${f.id} ${f.evidence.file}`), [], 'the baseline is supposed to be a clean install');
});

// The cross-check. A corrected example that happens to carry a different
// pair's defect is worse than no example at all, because it teaches the
// wrong thing.
test('no corrected install trips another pair failing finding', () => {
  const every = new Set(pairs.flatMap((p) => p.expect.fail));
  for (const p of pairs) {
    const allowed = new Set(p.expect.residual);
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

// The honest number. The pairs are the readable half of the evidence and
// they reach a minority of the catalogue, which is the reason the fixture
// corpus exists. Asserted so the claim in the README cannot drift.
test('the pairs reach a minority of the catalogue, and the README says which', () => {
  const reached = new Set(pairs.flatMap((p) => [...p.expect.fail, ...p.expect.residual]));
  const total = Object.keys(CATALOGUE).length;
  assert.ok(reached.size < total, 'the pairs are not supposed to reach everything');
  const readme = fs.readFileSync(path.join(examplesDir, '..', 'README.md'), 'utf8');
  assert.ok(
    readme.includes(`${reached.size} of the ${total}`),
    `README should say the pairs reach ${reached.size} of the ${total} catalogued findings`
  );
});
