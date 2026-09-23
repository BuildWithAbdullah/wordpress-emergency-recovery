import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInstall, run, ids, findingsFor } from './helpers.mjs';
import { KNOWN_DROPINS } from '../src/checks/dropins.mjs';

const only = { only: ['dropins'] };

test('a known drop-in is reported at medium, not as unknown', () => {
  const r = run(makeInstall({ 'wp-content/object-cache.php': '<?php\n' }, 'drop-known'), only);
  assert.equal(findingsFor(r, 'DROP002')[0].severity, 'medium');
  assert.ok(!ids(r).includes('DROP001'));
});

test('a file named like a drop-in but not on the list is critical', () => {
  const r = run(makeInstall({ 'wp-content/wp-cache-config.php': '<?php\n' }, 'drop-unknown'), only);
  const f = findingsFor(r, 'DROP001')[0];
  assert.equal(f.severity, 'critical');
  assert.match(f.detail, new RegExp(`${KNOWN_DROPINS.size} filenames`));
});

test('db.php with no plugin that could own it is reported separately', () => {
  const r = run(makeInstall({ 'wp-content/db.php': '<?php\n' }, 'drop-db'), only);
  assert.ok(ids(r).includes('DROP005'));
});

test('db.php beside a caching plugin is not reported as orphaned', () => {
  const r = run(makeInstall({
    'wp-content/db.php': '<?php\n',
    'wp-content/plugins/litespeed-cache/litespeed.php': '<?php\n'
  }, 'drop-db-owned'), only);
  assert.ok(!ids(r).includes('DROP005'));
});

test('every must-use plugin is reported', () => {
  const r = run(makeInstall({
    'wp-content/mu-plugins/a.php': '<?php\n',
    'wp-content/mu-plugins/b.php': '<?php\n'
  }, 'drop-mu'), only);
  assert.equal(findingsFor(r, 'DROP003').length, 2);
});

test('a must-use loader that reaches outside mu-plugins is reported', () => {
  const r = run(makeInstall({
    'wp-content/mu-plugins/loader.php': "<?php\nrequire_once '../uploads/cache/boot.php';\n"
  }, 'drop-mu-loader'), only);
  const f = findingsFor(r, 'DROP004')[0];
  assert.ok(f);
  assert.equal(f.evidence.line, 2);
});

test('a must-use plugin that includes a sibling file is not reported as reaching out', () => {
  const r = run(makeInstall({
    'wp-content/mu-plugins/loader.php': "<?php\nrequire_once __DIR__ . '/helpers.php';\n"
  }, 'drop-mu-ok'), only);
  assert.ok(!ids(r).includes('DROP004'));
});

test('the known drop-in list holds the filenames WordPress actually loads', () => {
  for (const name of ['advanced-cache.php', 'db.php', 'object-cache.php', 'maintenance.php', 'sunrise.php']) {
    assert.ok(KNOWN_DROPINS.has(name), `${name} should be on the drop-in list`);
  }
  assert.ok(!KNOWN_DROPINS.has('wp-cache-config.php'));
});
