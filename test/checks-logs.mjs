import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInstall, run, ids, findingsFor } from './helpers.mjs';

const only = { only: ['logs'] };
const withLog = (body, rel = 'wp-content/debug.log') => makeInstall({ [rel]: body }, 'logs');

test('a fatal error is found with the file and line it names', () => {
  const r = run(withLog('[23-Sep-2026 06:00:00 UTC] PHP Fatal error:  Uncaught Error: Call to undefined function acme_boot() in /var/www/site/wp-content/themes/t/functions.php on line 42\n'), only);
  const f = findingsFor(r, 'LOG001')[0];
  assert.equal(f.severity, 'critical');
  assert.match(f.detail, /functions\.php line 42/);
});

test('memory exhaustion is reported', () => {
  const r = run(withLog('[23-Sep-2026] PHP Fatal error:  Allowed memory size of 268435456 bytes exhausted (tried to allocate 20480 bytes) in /var/www/site/wp-includes/query.php on line 12\n'), only);
  assert.ok(ids(r).includes('LOG002'));
});

test('an execution timeout is reported', () => {
  assert.ok(ids(run(withLog('PHP Fatal error:  Maximum execution time of 30 seconds exceeded in /var/www/x.php on line 3\n'), only)).includes('LOG003'));
});

test('a redeclared function is reported', () => {
  assert.ok(ids(run(withLog('PHP Fatal error:  Cannot redeclare acme_init() (previously declared in /var/www/a.php:2) in /var/www/b.php on line 2\n'), only)).includes('LOG004'));
});

test('headers already sent is reported', () => {
  const r = run(withLog('PHP Warning:  Cannot modify header information - headers already sent by (output started at /var/www/site/wp-content/themes/t/functions.php:1) in /var/www/site/wp-includes/pluggable.php on line 1435\n'), only);
  assert.ok(ids(r).includes('LOG005'));
});

test('a log inside wp-content is flagged as web reachable', () => {
  assert.ok(ids(run(withLog('nothing interesting\n'), only)).includes('LOG006'));
});

test('a log outside wp-content is not flagged as web reachable', () => {
  const r = run(withLog('nothing interesting\n', 'logs/error.log'), only);
  assert.ok(!ids(r).includes('LOG006'));
});

test('an oversized log is reported as large', () => {
  const r = run(withLog('x'.repeat(6 * 1024 * 1024) + '\n'), only);
  const f = findingsFor(r, 'LOG007')[0];
  assert.ok(f);
  assert.match(f.detail, /6 MB/);
});

test('each pattern is reported once per log file, not once per line', () => {
  const line = 'PHP Fatal error:  Uncaught Error: boom in /var/www/a.php on line 1\n';
  const r = run(withLog(line.repeat(20)), only);
  assert.equal(findingsFor(r, 'LOG001').length, 1);
});

test('an install with no log files reports nothing', () => {
  const r = run(makeInstall({}, 'logs-none'), only);
  assert.deepEqual(r.findings, []);
});
