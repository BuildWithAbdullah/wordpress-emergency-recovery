import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInstall, examplesDir, run, makeInstall } from './helpers.mjs';
import path from 'node:path';
import { renderReport, FORMATS } from '../src/report/index.mjs';
import { exitCodeFor } from '../src/triage.mjs';
import { CHECKS } from '../src/checks/index.mjs';

// Built from character codes so this file does not contain the characters
// it is testing for.
const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');

const failing = () => run(buildInstall(path.join(examplesDir, 'uploads-php-shell', 'fail'), 'report'));

test('three formats are offered and each produces output', () => {
  assert.deepEqual(Object.keys(FORMATS).sort(), ['json', 'markdown', 'text']);
  const r = failing();
  for (const f of Object.keys(FORMATS)) assert.ok(renderReport(r, f).length > 200, `${f} produced nothing`);
});

test('an unknown format is refused', () => {
  assert.throws(() => renderReport(failing(), 'pdf'), /unknown format/);
});

test('the json report parses and keeps every field a reader needs', () => {
  const parsed = JSON.parse(renderReport(failing(), 'json'));
  assert.equal(parsed.tool, 'wp-triage');
  assert.ok(Array.isArray(parsed.findings));
  for (const f of parsed.findings) {
    for (const key of ['id', 'check', 'severity', 'title', 'evidence', 'nextAction', 'doesNotProve']) {
      assert.ok(key in f, `finding is missing ${key}`);
    }
  }
});

test('the text report prints what each finding does not prove', () => {
  const text = renderReport(failing(), 'text');
  assert.match(text, /not proof of/);
  assert.match(text, /None of them is a conclusion/);
});

test('the markdown report is valid enough to render a table and headings', () => {
  const md = renderReport(failing(), 'markdown');
  assert.match(md, /^# wp-triage report/m);
  assert.match(md, /\| Severity \| Count \|/);
  assert.match(md, /^### UP003/m);
});

test('a report with no findings says so without claiming the site is clean', () => {
  const r = run(makeInstall({}, 'report-clean'), { skip: CHECKS.map((c) => c.id) });
  assert.deepEqual(r.findings, []);
  for (const format of ['text', 'markdown']) {
    const out = renderReport(r, format);
    assert.match(out, /not a clean bill of health/);
  }
});

test('findings are ordered by severity, worst first', () => {
  const r = failing();
  const ranks = r.findings.map((f) => ['critical', 'high', 'medium', 'low', 'info'].indexOf(f.severity));
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b));
});

test('no report text contains an em dash or an en dash', () => {
  const r = failing();
  for (const format of Object.keys(FORMATS)) {
    assert.ok(!DASHES.test(renderReport(r, format)), `${format} report contains a dash character`);
  }
});

test('the exit code follows the fail-on threshold', () => {
  const r = failing();
  assert.equal(exitCodeFor(r, 'critical'), 1);
  assert.equal(exitCodeFor(r, 'high'), 1);
  const clean = run(makeInstall({}, 'report-exit'));
  assert.equal(exitCodeFor(clean, 'high'), 0);
  assert.equal(exitCodeFor(clean, 'info'), 1, 'the baseline reports the version at info');
});

test('the summary counts match the findings list', () => {
  const r = failing();
  const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
  assert.equal(total, r.findings.length);
});
