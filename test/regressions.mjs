import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readConstant } from '../src/checks/config.mjs';
import { classify } from '../src/checks/logs.mjs';
import { liveLines } from '../src/checks/htaccess.mjs';
import { buildInstall, run, ids, findingsFor } from './helpers.mjs';

// One test per defect found on 26 October 2026 while writing the fixture
// corpus, each one failing on the code as it was. They are kept separate
// from the corpus because the corpus asserts what the tool reports and these
// assert why, which is the part that would quietly come back.

const w = (d, rel, content) => {
  const abs = path.join(d, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
const ed = (d, rel, fn) => {
  const abs = path.join(d, rel);
  fs.writeFileSync(abs, fn(fs.readFileSync(abs, 'utf8')));
};
const install = (label, mutate) => {
  const dir = buildInstall(null, label);
  mutate(dir);
  return run(dir);
};

// 1. The constant parser stopped at the first closing parenthesis, so the
// commonest real form of WP_DEBUG_LOG captured half of its own value and was
// then judged on the half. The constant was reported as absent.
test('a define whose value contains a call is read whole', () => {
  const text = "<?php\ndefine( 'WP_DEBUG_LOG', dirname( __FILE__ ) . '/wp-content/debug.log' );\n";
  const c = readConstant(text, 'WP_DEBUG_LOG');
  assert.ok(c, 'the constant is found');
  assert.equal(c.raw, "dirname( __FILE__ ) . '/wp-content/debug.log'");
  assert.equal(c.line, 2);

  const r = install('reg-const', (d) => ed(d, 'wp-config.php', (t) => t.replace('$table_prefix', text.split('\n')[1] + '\n$table_prefix')));
  assert.ok(ids(r).includes('CONFIG002'), 'and the finding it feeds is reported');
});

test('a parenthesis inside a string does not end the value, and an unbalanced define is not guessed at', () => {
  assert.equal(readConstant("<?php define( 'A', 'a)b' );", 'A').raw, "'a)b'");
  assert.equal(readConstant("<?php define( 'A', dirname( __FILE__ ;", 'A'), null);
});

// 2. Every specific log pattern also matched the general fatal error line,
// because PHP writes an exhausted memory ceiling as a fatal error. One line
// came back under two ids whose next actions disagree.
test('a log line is classified under one reason, the specific one', () => {
  assert.equal(classify('PHP Fatal error:  Allowed memory size of 1 bytes exhausted in /x.php on line 1'), 'LOG002');
  assert.equal(classify('PHP Fatal error:  Maximum execution time of 30 seconds exceeded in /x.php on line 1'), 'LOG003');
  assert.equal(classify('PHP Fatal error:  Cannot redeclare f() in /x.php on line 1'), 'LOG004');
  assert.equal(classify('PHP Fatal error:  Uncaught Error: boom in /x.php on line 1'), 'LOG001');
  assert.equal(classify('PHP Notice:  nothing to do here'), null);
});

test('a log holding every shape reports each line once and no line twice', () => {
  const r = install('reg-log', (d) => w(d, 'logs/error.log', [
    'PHP Fatal error:  Allowed memory size of 268435456 bytes exhausted in /var/www/html/a.php on line 1',
    'PHP Fatal error:  Maximum execution time of 30 seconds exceeded in /var/www/html/b.php on line 2',
    'PHP Fatal error:  Uncaught Error: boom in /var/www/html/c.php on line 3',
    ''
  ].join('\n')));
  const log = ids(r).filter((id) => id.startsWith('LOG'));
  assert.deepEqual(log.slice().sort(), ['LOG001', 'LOG002', 'LOG003']);
  assert.equal(findingsFor(r, 'LOG001').length, 1, 'the general finding fires once, for the line that is only general');
  assert.equal(findingsFor(r, 'LOG001')[0].detail, 'Names /var/www/html/c.php line 3.');
});

// 3. Comment lines were stripped before the directives were read, which
// renumbered the file. Every line number reported from a .htaccess with
// comments in it pointed somewhere else, and a responder opening the file at
// that line finds a comment.
test('a htaccess finding names the line the directive is on in the file', () => {
  const body = [
    '# BEGIN WordPress',
    '<IfModule mod_rewrite.c>',
    'RewriteEngine On',
    '</IfModule>',
    '# END WordPress',
    '',
    '# staging only, remove before launch',
    '# contact: ops',
    'php_value auto_prepend_file /tmp/aa.php',
    ''
  ].join('\n');
  const r = install('reg-hta', (d) => w(d, '.htaccess', body));
  const f = findingsFor(r, 'HTA003')[0];
  assert.ok(f, 'the directive is found');
  assert.equal(f.evidence.line, 9);
  assert.equal(body.split('\n')[f.evidence.line - 1], 'php_value auto_prepend_file /tmp/aa.php');
});

test('the line map covers a file that is all comments and one that has none', () => {
  assert.deepEqual(liveLines('# a\n# b\n').map, [3]);
  assert.deepEqual(liveLines('a\nb\nc').map, [1, 2, 3]);
  assert.deepEqual(liveLines('# a\nb\n  # c\nd').map, [2, 4]);
});

test('a commented out handler in uploads is still not reported', () => {
  const r = install('reg-hta-comment', (d) => w(d, 'wp-content/uploads/.htaccess',
    '# AddHandler application/x-httpd-php .php\n# left here from last time\n'));
  assert.ok(!ids(r).includes('HTA002'), 'a comment is not a directive');
});

// 4. A byte order mark in wp-config.php came back under two ids for the same
// three bytes, and the config finding counted them as one byte because the
// file had already been decoded as text.
test('a byte order mark in wp-config is reported once, by the check that names it', () => {
  const r = install('reg-bom', (d) => ed(d, 'wp-config.php', (t) => '﻿' + t));
  const found = ids(r);
  assert.ok(found.includes('OUT003'), 'the mark is reported');
  assert.ok(!found.includes('CONFIG007'), 'and not also as unidentified bytes before the tag');
});

test('a byte order mark followed by real output is both findings, and the count is in bytes', () => {
  const r = install('reg-bom-plus', (d) => ed(d, 'wp-config.php', (t) => '﻿\n' + t));
  const found = ids(r);
  assert.ok(found.includes('OUT003') && found.includes('CONFIG007'), 'two problems, two findings');
  assert.equal(findingsFor(r, 'CONFIG007')[0].detail, '4 byte(s) precede the opening tag.');
});

// 5. Trailing output was reported on any file with one opening tag and
// anything at all after the closing tag. On a template that drops out of PHP
// on purpose, the next action is to delete the closing tag and what follows,
// which deletes the page.
test('markup after the closing tag of a template is not reported as trailing output', () => {
  const r = install('reg-tpl', (d) => w(d, 'wp-content/plugins/sample-plugin/view.php',
    '<?php $title = "Hello"; ?>\n<div class="wrap">\n  <h2>Sample</h2>\n</div>\n'));
  assert.ok(!ids(r).includes('OUT002'), 'the markup is the output, not a mistake');
});

test('whitespace after the closing tag of a pure PHP file is still reported', () => {
  const r = install('reg-ws', (d) => w(d, 'wp-content/plugins/sample-plugin/sample-plugin.php',
    '<?php\n// Plugin Name: Sample\n?>\n\n  \n'));
  assert.ok(ids(r).includes('OUT002'), 'trailing whitespace is what the finding is for');
});

// 6. An install with no index.php at all reported nothing, because the only
// check on the front controller read its contents and a missing file reads as
// null. The web server has nothing to hand a request to.
test('an install with no front controller is not reported as clean', () => {
  const r = install('reg-index', (d) => fs.rmSync(path.join(d, 'index.php')));
  const found = ids(r);
  assert.ok(found.includes('SHAPE006'), 'the missing front controller is reported');
  assert.ok(!found.includes('SHAPE004'), 'and not as a front controller that does the wrong thing');
  assert.equal(findingsFor(r, 'SHAPE006')[0].severity, 'critical');
});
