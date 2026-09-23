import test from 'node:test';
import assert from 'node:assert/strict';
import { makeInstall, run, ids, findingsFor } from './helpers.mjs';

const only = { only: ['uploads'] };

test('a PHP file in uploads is critical', () => {
  const r = run(makeInstall({ 'wp-content/uploads/2026/01/x.php': '<?php\n' }, 'up-php'), only);
  assert.equal(findingsFor(r, 'UP001')[0].severity, 'critical');
});

test('the silence guard index.php is not a finding', () => {
  const r = run(makeInstall({}, 'up-clean'), only);
  assert.deepEqual(ids(r), []);
});

test('an index.php in uploads that is not the silence guard is reported', () => {
  const r = run(makeInstall({ 'wp-content/uploads/index.php': "<?php\nsystem($_GET['c']);\n" }, 'up-index'), only);
  assert.ok(ids(r).includes('UP001'));
});

test('alternate PHP extensions are reported', () => {
  for (const ext of ['phtml', 'php5', 'phar', 'pht']) {
    const r = run(makeInstall({ [`wp-content/uploads/a.${ext}`]: '<?php\n' }, 'up-alt-' + ext), only);
    assert.ok(ids(r).includes('UP002'), `.${ext} should be reported`);
  }
});

test('a double extension is reported as UP003 and not also as UP001', () => {
  const r = run(makeInstall({ 'wp-content/uploads/a.jpg.php': '<?php\n' }, 'up-double'), only);
  assert.deepEqual(ids(r), ['UP003']);
});

test('an image whose first bytes are a PHP tag is reported', () => {
  const r = run(makeInstall({ 'wp-content/uploads/logo.png': '<?php echo 1;\n' }, 'up-disguise'), only);
  assert.ok(ids(r).includes('UP004'));
});

test('a real looking image is not reported', () => {
  const r = run(makeInstall({ 'wp-content/uploads/logo.png': '\x89PNG\r\n\x1a\n binary bytes' }, 'up-image'), only);
  assert.deepEqual(ids(r), []);
});

test('files outside uploads are not the uploads check problem', () => {
  const r = run(makeInstall({ 'wp-content/themes/sample-theme/extra.php': '<?php\n' }, 'up-outside'), only);
  assert.deepEqual(ids(r), []);
});
