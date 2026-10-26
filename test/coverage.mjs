import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGUE } from '../src/findings.mjs';
import { FIXTURES } from './corpus.mjs';
import { buildInstall, run, ids, manifest } from './helpers.mjs';

const set = (list) => [...new Set(list)].sort();
const catalogue = Object.keys(CATALOGUE);

test('every catalogued finding has one fixture of its own', () => {
  const own = FIXTURES.map((f) => f.id);
  assert.equal(own.length, new Set(own).size, 'two fixtures claim the same id');
  assert.deepEqual(set(own), set(catalogue));
});

test('every fixture says what it is', () => {
  for (const f of FIXTURES) {
    assert.ok(f.summary && f.summary.length > 20, `${f.id} needs a summary`);
    assert.equal(typeof f.build, 'function', `${f.id} needs a build function`);
    assert.ok(f.expect.includes(f.id), `${f.id} does not expect its own finding`);
  }
});

// The whole point of the corpus. Set equality in both directions on every
// fixture: a fixture that produces an extra finding fails exactly as loudly
// as one that produces too few, because an undeclared finding is one nobody
// has looked at.
for (const f of FIXTURES) {
  test(`${f.id}: reports exactly ${set(f.expect).join(', ')}`, () => {
    const dir = buildInstall(null, `cov-${f.id}`);
    f.build(dir);
    assert.deepEqual(set(ids(run(dir))), set(f.expect));
  });
}

test('the corpus between it reaches the entire catalogue', () => {
  const reached = new Set(FIXTURES.flatMap((f) => f.expect));
  assert.deepEqual(catalogue.filter((id) => !reached.has(id)), []);
});

// The gap between the readable half of the evidence and the whole of it.
// This number is the argument for the corpus existing, so it is asserted
// rather than claimed.
test('the example pairs reach a minority of the catalogue and the fixtures reach the rest', () => {
  const byPairs = new Set(manifest().pairs.flatMap((p) => [...p.expect.fail, ...p.expect.residual]));
  const onlyFixtures = catalogue.filter((id) => !byPairs.has(id));
  assert.ok(byPairs.size < catalogue.length / 2, `the pairs reach ${byPairs.size} of ${catalogue.length}`);
  assert.equal(byPairs.size + onlyFixtures.length, catalogue.length);
  assert.ok(onlyFixtures.length > 0, 'if the pairs reached everything the corpus would be redundant');
});
