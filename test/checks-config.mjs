import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInstall, run, ids, findingsFor } from './helpers.mjs';

const only = { only: ['config'] };
const config = (body) => makeInstall({ 'wp-config.php': body }, 'config');

test('debug on with display left at its default is reported', () => {
  const r = run(config("<?php\ndefine( 'WP_DEBUG', true );\n"), only);
  const f = findingsFor(r, 'CONFIG001')[0];
  assert.ok(f);
  assert.equal(f.evidence.line, 2);
  assert.match(f.detail, /not defined/);
});

test('debug on with display explicitly false is not reported', () => {
  const r = run(config("<?php\ndefine( 'WP_DEBUG', true );\ndefine( 'WP_DEBUG_DISPLAY', false );\n"), only);
  assert.ok(!ids(r).includes('CONFIG001'));
});

test('a debug log path inside wp-content is reported', () => {
  const r = run(config("<?php\ndefine( 'WP_DEBUG_LOG', '/var/www/site/wp-content/debug.log' );\n"), only);
  assert.ok(ids(r).includes('CONFIG002'));
});

test('a debug log path outside the web root is not reported', () => {
  const r = run(config("<?php\ndefine( 'WP_DEBUG_LOG', '/var/log/site/debug.log' );\n"), only);
  assert.ok(!ids(r).includes('CONFIG002'));
});

test('sample database credentials are critical', () => {
  const r = run(config("<?php\ndefine( 'DB_NAME', 'database_name_here' );\n"), only);
  const f = findingsFor(r, 'CONFIG003')[0];
  assert.equal(f.severity, 'critical');
  assert.match(f.detail, /database_name_here/);
});

test('sample salts are reported once with a count', () => {
  const r = run(config("<?php\ndefine( 'AUTH_KEY', 'put your unique phrase here' );\ndefine( 'NONCE_KEY', 'put your unique phrase here' );\n"), only);
  const f = findingsFor(r, 'CONFIG004');
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /2 salt/);
});

test('bytes before the opening tag are critical and reported on line 1', () => {
  const r = run(config("\n\n<?php\ndefine( 'WP_DEBUG', false );\n"), only);
  const f = findingsFor(r, 'CONFIG007')[0];
  assert.equal(f.severity, 'critical');
  assert.equal(f.evidence.line, 1);
  assert.match(f.detail, /2 byte/);
});

test('a hardcoded site URL is reported for each constant', () => {
  const r = run(config("<?php\ndefine( 'WP_HOME', 'https://example.test' );\ndefine( 'WP_SITEURL', 'https://example.test' );\n"), only);
  assert.equal(findingsFor(r, 'CONFIG005').length, 2);
});

test('the default table prefix is info, not a problem', () => {
  const r = run(config("<?php\n$table_prefix = 'wp_';\n"), only);
  assert.equal(findingsFor(r, 'CONFIG009')[0].severity, 'info');
});

test('a custom table prefix is not reported', () => {
  const r = run(config("<?php\n$table_prefix = 'x7a_';\n"), only);
  assert.ok(!ids(r).includes('CONFIG009'));
});

test('a missing memory limit is low, and setting one clears it', () => {
  assert.ok(ids(run(config("<?php\n"), only)).includes('CONFIG008'));
  assert.ok(!ids(run(config("<?php\ndefine( 'WP_MEMORY_LIMIT', '256M' );\n"), only)).includes('CONFIG008'));
});

test('no wp-config.php means the config check reports nothing rather than throwing', () => {
  const r = run(makeInstall({ 'wp-config.php': null }, 'config-none'), only);
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.checkErrors, []);
});
