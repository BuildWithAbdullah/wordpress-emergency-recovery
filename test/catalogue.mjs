import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CATALOGUE, SEVERITIES, make, severityRank } from '../src/findings.mjs';
import { CHECKS } from '../src/checks/index.mjs';
import { repoRoot } from './helpers.mjs';

// Built from character codes so this file does not contain the characters
// it is testing for.
const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');

const entries = Object.entries(CATALOGUE);

test('the catalogue is not empty and every id is uppercase with a number', () => {
  assert.ok(entries.length >= 40);
  for (const [id] of entries) assert.match(id, /^[A-Z]+\d{3}$/);
});

test('every entry states a severity that exists', () => {
  for (const [id, e] of entries) {
    assert.ok(SEVERITIES.includes(e.severity), `${id} has severity ${e.severity}`);
  }
});

test('every entry belongs to a check module that exists', () => {
  const ids = new Set(CHECKS.map((c) => c.id));
  for (const [id, e] of entries) assert.ok(ids.has(e.check), `${id} points at unknown check ${e.check}`);
});

test('every check module owns at least one finding', () => {
  const owned = new Set(entries.map(([, e]) => e.check));
  for (const c of CHECKS) assert.ok(owned.has(c.id), `${c.id} owns no findings`);
});

test('every entry says what to do next and what it does not prove', () => {
  for (const [id, e] of entries) {
    assert.ok(e.title && e.title.length > 8, `${id} needs a title`);
    assert.ok(e.nextAction && e.nextAction.length > 40, `${id} needs a next action`);
    assert.ok(e.doesNotProve && e.doesNotProve.length > 40, `${id} needs a statement of what it does not prove`);
    assert.match(e.doesNotProve, /does not prove|proves only|not prove/i, `${id} should say plainly what it does not prove`);
  }
});

test('no finding text contains an em dash or an en dash', () => {
  for (const [id, e] of entries) {
    for (const field of ['title', 'nextAction', 'doesNotProve']) {
      assert.ok(!DASHES.test(e[field]), `${id}.${field} contains a dash character that should be plain text`);
    }
  }
});

test('make refuses an id that is not in the catalogue', () => {
  assert.throws(() => make('NOPE999'), /unknown finding id/);
});

test('make copies the catalogue text onto the finding', () => {
  const f = make('UPD001', { file: '.maintenance', line: 1, excerpt: 'x' }, { detail: 'd' });
  assert.equal(f.severity, CATALOGUE.UPD001.severity);
  assert.equal(f.nextAction, CATALOGUE.UPD001.nextAction);
  assert.equal(f.doesNotProve, CATALOGUE.UPD001.doesNotProve);
  assert.equal(f.check, 'updates');
  assert.equal(f.detail, 'd');
});

test('severity ranks order from critical down to info', () => {
  const ranked = [...SEVERITIES].sort((a, b) => severityRank(a) - severityRank(b));
  assert.deepEqual(ranked, ['critical', 'high', 'medium', 'low', 'info']);
  assert.ok(severityRank('nonsense') > severityRank('info'));
});

test('every finding id used anywhere in src is in the catalogue', () => {
  const used = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!p.endsWith('.mjs')) continue;
      const text = fs.readFileSync(p, 'utf8');
      for (const m of text.matchAll(/make\(\s*'([A-Z]+\d{3})'/g)) used.add(m[1]);
    }
  };
  walk(path.join(repoRoot, 'src'));
  for (const id of used) assert.ok(CATALOGUE[id], `${id} is raised in src but missing from the catalogue`);
  assert.ok(used.size >= 40, `expected most of the catalogue to be reachable, found ${used.size}`);
});

test('every catalogue entry is reachable from some check module', () => {
  const used = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!p.endsWith('.mjs')) continue;
      for (const m of fs.readFileSync(p, 'utf8').matchAll(/'([A-Z]+\d{3})'/g)) used.add(m[1]);
    }
  };
  walk(path.join(repoRoot, 'src'));
  const orphans = entries.map(([id]) => id).filter((id) => !used.has(id));
  assert.deepEqual(orphans, [], 'catalogue entries no check can ever raise');
});
