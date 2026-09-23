import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInstall, run, ids, findingsFor } from './helpers.mjs';

const only = { only: ['htaccess'] };

test('a missing root .htaccess is reported', () => {
  const r = run(makeInstall({ '.htaccess': null }, 'hta-none'), only);
  assert.ok(ids(r).includes('HTA001'));
});

test('a PHP handler inside uploads is critical', () => {
  const r = run(makeInstall({ 'wp-content/uploads/.htaccess': 'AddType application/x-httpd-php .php\n' }, 'hta-uploads'), only);
  assert.equal(findingsFor(r, 'HTA002')[0].severity, 'critical');
});

test('a handler that is commented out is not reported', () => {
  const r = run(makeInstall({ 'wp-content/uploads/.htaccess': '# AddType application/x-httpd-php .php\n' }, 'hta-comment'), only);
  assert.ok(!ids(r).includes('HTA002'));
});

test('a handler outside uploads is not reported by the uploads rule', () => {
  const r = run(makeInstall({ '.htaccess': 'AddType application/x-httpd-php .php\n' }, 'hta-root-handler'), only);
  assert.ok(!ids(r).includes('HTA002'));
});

test('auto_prepend_file is critical and names the file it prepends', () => {
  const r = run(makeInstall({ '.htaccess': 'php_value auto_prepend_file /var/www/.cache/boot.php\n' }, 'hta-prepend'), only);
  const f = findingsFor(r, 'HTA003')[0];
  assert.equal(f.severity, 'critical');
  assert.match(f.detail, /boot\.php/);
});

test('rules that force https and http in the same file are reported', () => {
  const r = run(makeInstall({
    '.htaccess': 'RewriteCond %{HTTPS} off\nRewriteRule ^(.*)$ https://a.test/$1 [R=301,L]\nRewriteRule ^(.*)$ http://a.test/$1 [R=301,L]\n'
  }, 'hta-loop'), only);
  assert.ok(ids(r).includes('HTA004'));
});

test('duplicated WordPress rule blocks are reported with a count', () => {
  const block = '# BEGIN WordPress\nRewriteEngine On\n# END WordPress\n';
  const r = run(makeInstall({ '.htaccess': block + block + block }, 'hta-dupe'), only);
  const f = findingsFor(r, 'HTA005')[0];
  assert.match(f.detail, /3 WordPress rule blocks/);
});

test('a single stock rule block is not reported', () => {
  const r = run(makeInstall({}, 'hta-clean'), only);
  assert.deepEqual(ids(r), []);
});
