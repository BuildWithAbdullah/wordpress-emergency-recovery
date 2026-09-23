import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInstall, run, ids, findingsFor } from './helpers.mjs';

const only = { only: ['obfuscation'] };
const REL = 'wp-content/plugins/sample-plugin/sample-plugin.php';
const php = (body) => makeInstall({ [REL]: '<?php\n' + body }, 'obf');

test('eval on base64 is critical', () => {
  const r = run(php('eval(base64_decode($x));\n'), only);
  const f = findingsFor(r, 'OBF001')[0];
  assert.equal(f.severity, 'critical');
  assert.equal(f.evidence.line, 2);
});

test('eval with an error suppressor in front of the decode is still caught', () => {
  assert.ok(ids(run(php('eval(@base64_decode($x));\n'), only)).includes('OBF001'));
});

test('eval on compressed input is caught', () => {
  for (const fn of ['gzinflate', 'gzuncompress', 'str_rot13', 'gzdecode']) {
    assert.ok(ids(run(php(`eval(${fn}($x));\n`), only)).includes('OBF002'), `${fn} should be caught`);
  }
});

test('base64_decode on its own is not a finding', () => {
  const r = run(php('$data = base64_decode($encoded);\n'), only);
  assert.ok(!ids(r).includes('OBF001'));
  assert.ok(!ids(r).includes('OBF002'));
});

test('preg_replace with the e modifier is caught', () => {
  assert.ok(ids(run(php('preg_replace("/(.*)/e", $code, $subject);\n'), only)).includes('OBF003'));
});

test('preg_replace without the e modifier is not caught', () => {
  assert.ok(!ids(run(php('preg_replace("/(.*)/i", "$1", $subject);\n'), only)).includes('OBF003'));
});

test('create_function is caught', () => {
  assert.ok(ids(run(php('$f = create_function("$a", "return $a;");\n'), only)).includes('OBF004'));
});

test('a long encoded blob is reported with its length', () => {
  const r = run(php(`$b = "${'QUJDREVG'.repeat(30)}";\n`), only);
  const f = findingsFor(r, 'OBF005')[0];
  assert.ok(f);
  assert.match(f.detail, /\d{3} characters/);
});

test('a short encoded string is not reported', () => {
  assert.ok(!ids(run(php('$b = "QUJDREVG";\n'), only)).includes('OBF005'));
});

test('a function name split into fragments is caught', () => {
  assert.ok(ids(run(php('$f = "ba" . "se64_" . "decode";\n'), only)).includes('OBF006'));
});

test('assert on a variable is caught', () => {
  assert.ok(ids(run(php('assert($code);\n'), only)).includes('OBF007'));
});

test('assert on a comparison is not caught', () => {
  assert.ok(!ids(run(php('assert($a === $b);\n'), only)).includes('OBF007'));
});

test('one very long line is reported once, not once per line', () => {
  const r = run(php(`$a = "${'x'.repeat(2500)}";\n$b = "${'y'.repeat(2500)}";\n`), only);
  assert.equal(findingsFor(r, 'OBF008').length, 1);
});

test('a clean baseline reports nothing', () => {
  assert.deepEqual(ids(run(makeInstall({}, 'obf-clean'), only)), []);
});

test('each rule is capped so one file cannot flood the report', () => {
  const r = run(php('eval(base64_decode($x));\n'.repeat(40)), only);
  assert.ok(findingsFor(r, 'OBF001').length <= 3);
});
