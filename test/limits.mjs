import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LIMITS } from '../src/limits.mjs';
import { buildInstall, run, ids, findingsFor } from './helpers.mjs';

const DAY = 86400000;
const CORE = ['wp-admin/admin.php', 'wp-admin/index.php'].concat(
  ['formatting', 'functions', 'http', 'load', 'option', 'plugin', 'post', 'query', 'user', 'version']
    .map((n) => `wp-includes/${n}.php`)
);

const w = (d, rel, content) => {
  const abs = path.join(d, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
};
const touch = (d, rel, ms) => {
  const when = new Date(Date.now() + ms);
  fs.utimesSync(path.join(d, rel), when, when);
};
const flatten = (d) => { for (const rel of CORE) touch(d, rel, 0); };
const install = (label, mutate) => {
  const dir = buildInstall(null, label);
  mutate(dir);
  return run(dir);
};

test('every limit in the table is covered by a test in this file', () => {
  const here = fs.readFileSync(new URL(import.meta.url), 'utf8');
  for (const l of LIMITS) {
    assert.ok(here.includes(l.id), `${l.id} has no test`);
    assert.ok(l.text.length > 120, `${l.id} needs a real explanation`);
  }
  assert.ok(LIMITS.every((l) => l.bothWays), 'every limit here is asserted in both directions');
});

// LIMIT-TIMESTAMPS. The strongest of these, and the reason it is first.
// Four installs: core bytes modified or not, crossed with the finding
// reported or not. All four exist, so CORE003 carries no implication in
// either direction about whether a core file was modified.
test('LIMIT-TIMESTAMPS: all four combinations of modified core and a reported finding exist', () => {
  const MODIFIED = '<?php\n// Replaced wholesale. Not one byte of this is core.\nreturn 1;\n';

  const cleanQuiet = install('t-cq', (d) => flatten(d));
  const modifiedQuiet = install('t-mq', (d) => {
    w(d, 'wp-includes/functions.php', MODIFIED);
    flatten(d);
  });
  const cleanLoud = install('t-cl', (d) => {
    flatten(d);
    touch(d, 'wp-admin/admin.php', -60 * DAY);
  });
  const modifiedLoud = install('t-ml', (d) => {
    w(d, 'wp-includes/functions.php', MODIFIED);
    flatten(d);
    touch(d, 'wp-includes/functions.php', -60 * DAY);
  });

  const reported = (r) => ids(r).includes('CORE003');

  assert.equal(reported(cleanQuiet), false, 'untouched core with one timestamp is quiet');
  assert.equal(reported(modifiedQuiet), false, 'core replaced byte for byte is quiet while the timestamp matches');
  assert.equal(reported(cleanLoud), true, 'untouched core is reported the moment a timestamp is skewed');
  assert.equal(reported(modifiedLoud), true, 'modified and skewed is reported, for the timestamp');

  // Stated as the assertion it is: for each value of the reported verdict,
  // both values of the thing a reader cares about occur.
  for (const verdict of [true, false]) {
    const cases = [cleanQuiet, modifiedQuiet, cleanLoud, modifiedLoud].filter((r) => reported(r) === verdict);
    assert.equal(cases.length, 2, `both a modified and an unmodified install report ${verdict}`);
  }
});

test('LIMIT-LOG-SIZE: the same fatal error is read under the cap and invisible over it', () => {
  const FATAL = 'PHP Fatal error:  Allowed memory size of 268435456 bytes exhausted'
    + ' (tried to allocate 20480 bytes) in /var/www/html/wp-includes/functions.php on line 900\n';

  const small = install('l-small', (d) => w(d, 'logs/error.log', FATAL));
  assert.ok(ids(small).includes('LOG002'), 'a readable log is read');
  assert.ok(!ids(small).includes('LOG007'), 'a small log is not reported as large');

  const huge = install('l-huge', (d) => w(d, 'logs/error.log', 'x'.repeat(6 * 1024 * 1024) + '\n' + FATAL));
  assert.ok(ids(huge).includes('LOG007'), 'a large log is reported as large');
  assert.ok(!ids(huge).includes('LOG002'), 'and the error inside it is not read');
});

test('LIMIT-CONSTANT-EXPRESSION: a literal is judged and an expression is not', () => {
  const on = (value) => (d) => {
    const p = path.join(d, 'wp-config.php');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8')
      .replace("define( 'WP_DEBUG', false );", `define( 'WP_DEBUG', ${value} );`)
      .replace("define( 'WP_DEBUG_DISPLAY', false );\n", ''));
  };

  assert.ok(ids(install('c-lit', on('true'))).includes('CONFIG001'), 'a literal true is judged');
  const expr = install('c-expr', on("getenv( 'WP_ENV' ) !== 'production'"));
  assert.ok(!ids(expr).includes('CONFIG001'), 'an expression is not judged, even when it is true at run time');
});

test('LIMIT-APPENDED-PAYLOAD: PHP in the first thirty two bytes is seen and PHP after them is not', () => {
  // A real PNG signature plus a complete header chunk, which is thirty three
  // bytes. That one byte over the read window is the whole limit.
  const PNG = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0, 0, 0, 13]),
    Buffer.from('IHDR', 'ascii'),
    Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
    Buffer.from([0x1f, 0x15, 0xc4, 0x89])
  ]);
  const PAYLOAD = Buffer.from('\n<?php\n// appended after the image data\n', 'utf8');
  assert.equal(PNG.length, 33, 'the header is one byte past the read window');

  const prepended = install('p-pre', (d) => w(d, 'wp-content/uploads/2026/10/a.png', Buffer.concat([PAYLOAD, PNG])));
  assert.ok(ids(prepended).includes('UP004'), 'a file whose first bytes are PHP is reported');

  const appended = install('p-post', (d) => w(d, 'wp-content/uploads/2026/10/b.png', Buffer.concat([PNG, PAYLOAD])));
  assert.ok(!ids(appended).includes('UP004'), 'a real image with PHP appended past the window is reported as nothing');

  // And the boundary itself, so the thirty two in the text is the real number
  // rather than a number somebody typed once.
  const inside = install('p-edge', (d) => w(d, 'wp-content/uploads/2026/10/c.png',
    Buffer.concat([PNG.subarray(0, 26), Buffer.from('<?php', 'ascii'), PAYLOAD])));
  assert.ok(ids(inside).includes('UP004'), 'the same payload one byte inside the window is reported');
});

test('LIMIT-PERMISSION-CAP: twenty five is both the count and the ceiling', () => {
  const spray = (n) => (d) => {
    for (let i = 0; i < n; i += 1) {
      const rel = `wp-content/uploads/2026/10/file-${i}.txt`;
      w(d, rel, 'x');
      fs.chmodSync(path.join(d, rel), 0o666);
    }
  };

  const exactly = install('perm-25', spray(25));
  assert.equal(findingsFor(exactly, 'PERM003').length, 25, 'twenty five world writable files are all reported');

  const flood = install('perm-40', spray(40));
  assert.equal(findingsFor(flood, 'PERM003').length, 25, 'forty are still reported as twenty five');
});

test('LIMIT-SYMLINKS: a shell is seen in a real directory and not through a link', () => {
  const SHELL = '<?php\n// a file that is not media\n';

  const real = install('s-real', (d) => w(d, 'wp-content/uploads/2026/10/x.php', SHELL));
  assert.ok(ids(real).includes('UP001'), 'a PHP file in uploads is reported');

  const linked = install('s-link', (d) => {
    fs.mkdirSync(path.join(d, 'elsewhere'), { recursive: true });
    fs.writeFileSync(path.join(d, 'elsewhere/x.php'), SHELL);
    fs.symlinkSync(path.join(d, 'elsewhere'), path.join(d, 'wp-content/uploads/2026'), 'dir');
  });
  assert.ok(!ids(linked).includes('UP001'), 'the same file reached only through a link is reported as nothing');
});

test('LIMIT-ONE-REASON: the worse reason is reported and the narrower one is absent', () => {
  const mu = (body) => (d) => w(d, 'wp-content/mu-plugins/loader.php', `<?php\n${body}\n`);

  const escapes = install('r-esc', mu("require_once '../../../opt/stage/boot.php';"));
  assert.ok(ids(escapes).includes('DROP004'), 'a target outside the directory is reported as that');
  assert.ok(!ids(escapes).includes('DROP006'), 'and not as a writable location');

  const writable = install('r-wr', mu("require_once 'wp-content/uploads/cache/warm.php';"));
  assert.ok(ids(writable).includes('DROP006'), 'a target in a writable directory is reported as that');
  assert.ok(!ids(writable).includes('DROP004'), 'and not also as leaving the directory');

  // The case that is both: reported once, under the worse reason, which
  // means the true statement that it leaves the directory is missing.
  const both = install('r-both', mu("require_once '../uploads/cache/warm.php';"));
  const found = ids(both);
  assert.ok(found.includes('DROP006'), 'a target that is both is reported as the writable case');
  assert.ok(!found.includes('DROP004'), 'the narrower reason is absent even though it is also true');

  // The same rule on a log line, where the generic fatal error is the
  // narrower reason and is dropped.
  const memory = install('r-log', (d) => w(d, 'logs/error.log',
    'PHP Fatal error:  Allowed memory size of 1 bytes exhausted in /var/www/html/x.php on line 1\n'));
  assert.ok(ids(memory).includes('LOG002'), 'the memory ceiling is the reason reported');
  assert.ok(!ids(memory).includes('LOG001'), 'and the line is not also reported as a fatal error');
});
