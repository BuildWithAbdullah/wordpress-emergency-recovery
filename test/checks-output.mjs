import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInstall, run, ids, findingsFor } from './helpers.mjs';
import { isPriority } from '../src/checks/output.mjs';

const only = { only: ['output'] };
const THEME = 'wp-content/themes/sample-theme/functions.php';

test('a blank line before the opening tag is reported on line 1', () => {
  const r = run(makeInstall({ [THEME]: '\n<?php\nadd_action();\n' }, 'out-before'), only);
  const f = findingsFor(r, 'OUT001')[0];
  assert.equal(f.evidence.line, 1);
  assert.match(f.detail, /1 byte/);
});

test('a byte order mark is reported as its own finding', () => {
  const r = run(makeInstall({ [THEME]: '﻿<?php\nadd_action();\n' }, 'out-bom'), only);
  assert.ok(ids(r).includes('OUT003'));
});

test('a byte order mark is not double reported as stray text', () => {
  const r = run(makeInstall({ [THEME]: '﻿<?php\n' }, 'out-bom2'), only);
  assert.ok(!ids(r).includes('OUT001'), 'a lone byte order mark is OUT003, not OUT001');
});

test('trailing bytes after the closing tag are reported', () => {
  const r = run(makeInstall({ [THEME]: '<?php\nadd_action();\n?>\n\n' }, 'out-after'), only);
  const f = findingsFor(r, 'OUT002')[0];
  assert.ok(f);
  assert.match(f.detail, /2 byte/);
});

test('a closing tag with nothing after it is not reported', () => {
  const r = run(makeInstall({ [THEME]: '<?php\nadd_action();\n?>' }, 'out-after-clean'), only);
  assert.ok(!ids(r).includes('OUT002'));
});

test('a file that mixes PHP and HTML is not reported for its closing tags', () => {
  const r = run(makeInstall({ [THEME]: '<?php if ( true ) { ?>\n<p>markup</p>\n<?php } ?>\n' }, 'out-mixed'), only);
  assert.ok(!ids(r).includes('OUT002'));
});

test('a clean baseline reports nothing', () => {
  assert.deepEqual(ids(run(makeInstall({}, 'out-clean'), only)), []);
});

test('the priority list covers the files that load before headers are sent', () => {
  for (const rel of ['wp-config.php', 'index.php', 'wp-load.php', 'wp-settings.php', 'wp-content/mu-plugins/a.php', 'wp-content/themes/t/functions.php', 'wp-content/plugins/p/p.php']) {
    assert.ok(isPriority(rel), `${rel} should be checked for stray output`);
  }
  assert.ok(!isPriority('wp-content/plugins/p/vendor/deep/lib.php'), 'deep vendor files are not worth walking');
});

test('wp-config.php stray output is left to the config check, not duplicated here', () => {
  const r = run(makeInstall({ 'wp-config.php': '\n<?php\n' }, 'out-config'), only);
  assert.ok(!ids(r).includes('OUT001'));
  const both = run(makeInstall({ 'wp-config.php': '\n<?php\n' }, 'out-config2'), { only: ['config', 'output'] });
  assert.equal(findingsFor(both, 'CONFIG007').length, 1);
});
