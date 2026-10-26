// The fixture corpus.
//
// One fixture per catalogued finding, each declaring the exact set of ids the
// tool reports on it. test/coverage.mjs asserts that set in both directions,
// so a fixture that produces an extra finding fails just as loudly as one
// that produces too few.
//
// The example pairs under examples/ are the readable half of the evidence.
// They reach a minority of the catalogue, because a pair has to be a plausible
// broken install a reader can recognise. These fixtures reach the rest, and
// they are allowed to be artificial.
//
// Fixtures that carry a malware shaped string build it from fragments at run
// time. The string never exists in a file on disk in this repository, and
// nothing here is ever executed: every fixture is read by the scanner as text.

import fs from 'node:fs';
import path from 'node:path';

const DAY = 86400000;

// ---- small helpers used by the fixtures ---------------------------------

function write(dir, rel, content) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function remove(dir, rel) {
  fs.rmSync(path.join(dir, rel), { recursive: true, force: true });
}

function chmod(dir, rel, mode) {
  fs.chmodSync(path.join(dir, rel), mode);
}

function touch(dir, rel, msFromNow) {
  const when = new Date(Date.now() + msFromNow);
  fs.utimesSync(path.join(dir, rel), when, when);
}

function edit(dir, rel, fn) {
  const abs = path.join(dir, rel);
  fs.writeFileSync(abs, fn(fs.readFileSync(abs, 'utf8')));
}

// A PHP file that is correct in every way the scanner cares about, so a
// fixture only has to add the one thing it is about.
function plainPhp(body) {
  return `<?php\n// A fixture file.\n${body}\n`;
}

// Malware shaped needles, assembled so that no file in this repository
// contains the pattern the scanner looks for. The same trick the house style
// check in tools/verify.mjs uses on itself.
const EVAL = 'ev' + 'al';
const B64 = 'base' + '64_decode';
const GZ = 'gz' + 'inflate';
const CREATE_FN = 'create_' + 'function';
const ASSERT = 'as' + 'sert';
const PREG = 'preg_' + 'replace';
const BLOB = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkr'
  + 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkr'
  + 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkr';

const LOG_FATAL = '[26-Oct-2026 09:14:02 UTC] PHP Fatal error:  Uncaught Error: Call to undefined'
  + ' function wpx_boot() in /var/www/html/wp-content/plugins/sample-plugin/sample-plugin.php on line 41';
const LOG_MEMORY = '[26-Oct-2026 09:15:40 UTC] PHP Fatal error:  Allowed memory size of 268435456 bytes'
  + ' exhausted (tried to allocate 20480 bytes) in /var/www/html/wp-includes/functions.php on line 900';
const LOG_TIME = '[26-Oct-2026 09:16:11 UTC] PHP Fatal error:  Maximum execution time of 30 seconds'
  + ' exceeded in /var/www/html/wp-includes/http.php on line 212';
const LOG_REDECLARE = '[26-Oct-2026 09:17:02 UTC] PHP Fatal error:  Cannot redeclare wpx_init()'
  + ' (previously declared in /var/www/html/wp-content/plugins/sample-plugin/sample-plugin.php:12)'
  + ' in /var/www/html/wp-content/plugins/sample-plugin-old/sample-plugin.php on line 12';
const LOG_HEADERS = '[26-Oct-2026 09:18:20 UTC] PHP Warning:  Cannot modify header information,'
  + ' headers already sent by (output started at'
  + ' /var/www/html/wp-content/themes/sample-theme/functions.php:1) in'
  + ' /var/www/html/wp-includes/option.php on line 44';

// A log that says nothing, for the fixtures that are about where a log is
// rather than what is in it.
const LOG_QUIET = '[26-Oct-2026 09:00:00 UTC] PHP Notice:  a notice nobody needs to act on\n';

// wp-includes/version.php is the newest core file in the baseline, which the
// mtime fixtures below depend on.
const WP_INCLUDES_PHP = [
  'formatting.php', 'functions.php', 'http.php', 'load.php', 'option.php',
  'plugin.php', 'post.php', 'query.php', 'user.php', 'version.php'
];

export const FIXTURES = [
  // ---- install shape ----------------------------------------------------
  {
    id: 'SHAPE001',
    summary: 'No configuration file at the path given.',
    build: (d) => remove(d, 'wp-config.php'),
    expect: ['SHAPE001', 'SHAPE005']
  },
  {
    id: 'SHAPE002',
    summary: 'Core is incomplete: the file that names the release is gone.',
    build: (d) => remove(d, 'wp-includes/version.php'),
    expect: ['SHAPE002']
  },
  {
    id: 'SHAPE003',
    summary: 'wp-content is not where WordPress looks for it by default.',
    build: (d) => remove(d, 'wp-content'),
    expect: ['SHAPE003', 'SHAPE005']
  },
  {
    id: 'SHAPE004',
    summary: 'The front controller no longer loads the blog header.',
    build: (d) => write(d, 'index.php', plainPhp("require __DIR__ . '/wp-load.php';")),
    expect: ['SHAPE004', 'SHAPE005']
  },
  {
    id: 'SHAPE006',
    summary: 'Nothing at the web root to hand a request to.',
    build: (d) => remove(d, 'index.php'),
    expect: ['SHAPE005', 'SHAPE006']
  },
  {
    id: 'SHAPE005',
    summary: 'The clean baseline, which reports its release and nothing else.',
    build: () => {},
    expect: ['SHAPE005']
  },

  // ---- wp-config --------------------------------------------------------
  {
    id: 'CONFIG001',
    summary: 'Debug is on and nothing turns the display of errors off.',
    build: (d) => edit(d, 'wp-config.php', (t) => t
      .replace("define( 'WP_DEBUG', false );", "define( 'WP_DEBUG', true );")
      .replace("define( 'WP_DEBUG_DISPLAY', false );\n", '')),
    expect: ['CONFIG001', 'SHAPE005']
  },
  {
    id: 'CONFIG002',
    summary: 'The debug log is configured to land inside the web root.',
    build: (d) => edit(d, 'wp-config.php', (t) => t
      .replace("define( 'WP_DEBUG', false );",
        "define( 'WP_DEBUG', false );\ndefine( 'WP_DEBUG_LOG', '/var/www/html/wp-content/debug.log' );")),
    expect: ['CONFIG002', 'SHAPE005']
  },
  {
    id: 'CONFIG003',
    summary: 'The sample database credentials were never replaced.',
    build: (d) => edit(d, 'wp-config.php', (t) => t.replace("'site_db'", "'database_name_here'")),
    expect: ['CONFIG003', 'SHAPE005']
  },
  {
    id: 'CONFIG004',
    summary: 'The authentication salts are still the sample phrase.',
    build: (d) => edit(d, 'wp-config.php', (t) => t
      .replace("'h1Qd+7yTQmS0vX2fLpN8aZ3cRkE6uJwB'", "'put your unique phrase here'")
      .replace("'p4Zx*2mKdV9sT7eGqLb0nYcH5rWjA8uF'", "'put your unique phrase here'")),
    expect: ['CONFIG004', 'SHAPE005']
  },
  {
    id: 'CONFIG005',
    summary: 'The site address is pinned in the configuration file.',
    build: (d) => edit(d, 'wp-config.php', (t) => t
      .replace("$table_prefix", "define( 'WP_HOME', 'https://example.test' );\n$table_prefix")),
    expect: ['CONFIG005', 'SHAPE005']
  },
  {
    id: 'CONFIG006',
    summary: 'File modifications are disallowed, so updates fail silently.',
    build: (d) => edit(d, 'wp-config.php', (t) => t
      .replace("$table_prefix", "define( 'DISALLOW_FILE_MODS', true );\n$table_prefix")),
    expect: ['CONFIG006', 'SHAPE005']
  },
  {
    id: 'CONFIG010',
    summary: 'The built in file editor is disabled, which is not the same thing.',
    build: (d) => edit(d, 'wp-config.php', (t) => t
      .replace("$table_prefix", "define( 'DISALLOW_FILE_EDIT', true );\n$table_prefix")),
    expect: ['CONFIG010', 'SHAPE005']
  },
  {
    id: 'CONFIG007',
    summary: 'A blank line before the opening tag of the configuration file.',
    build: (d) => edit(d, 'wp-config.php', (t) => '\n' + t),
    expect: ['CONFIG007', 'SHAPE005']
  },
  {
    id: 'CONFIG008',
    summary: 'No memory ceiling is set for WordPress.',
    build: (d) => edit(d, 'wp-config.php', (t) => t.replace("define( 'WP_MEMORY_LIMIT', '256M' );\n", '')),
    expect: ['CONFIG008', 'SHAPE005']
  },
  {
    id: 'CONFIG009',
    summary: 'The table prefix is the default one.',
    build: (d) => edit(d, 'wp-config.php', (t) => t.replace("$table_prefix = 'site_';", "$table_prefix = 'wp_';")),
    expect: ['CONFIG009', 'SHAPE005']
  },

  // ---- error logs -------------------------------------------------------
  {
    id: 'LOG001',
    summary: 'A fatal error recorded in a log outside the web root.',
    build: (d) => write(d, 'logs/error.log', LOG_QUIET + LOG_FATAL + '\n'),
    expect: ['LOG001', 'SHAPE005']
  },
  {
    id: 'LOG002',
    summary: 'The log records an exhausted memory ceiling.',
    build: (d) => write(d, 'logs/error.log', LOG_QUIET + LOG_MEMORY + '\n'),
    expect: ['LOG002', 'SHAPE005']
  },
  {
    id: 'LOG003',
    summary: 'The log records a request that ran out of execution time.',
    build: (d) => write(d, 'logs/error.log', LOG_QUIET + LOG_TIME + '\n'),
    expect: ['LOG003', 'SHAPE005']
  },
  {
    id: 'LOG004',
    summary: 'The log records the same function declared twice.',
    build: (d) => write(d, 'logs/error.log', LOG_QUIET + LOG_REDECLARE + '\n'),
    expect: ['LOG004', 'SHAPE005']
  },
  {
    id: 'LOG005',
    summary: 'The log records output starting before the headers were sent.',
    build: (d) => write(d, 'logs/error.log', LOG_QUIET + LOG_HEADERS + '\n'),
    expect: ['LOG005', 'SHAPE005']
  },
  {
    id: 'LOG006',
    summary: 'A quiet debug log sitting where a request could reach it.',
    build: (d) => write(d, 'wp-content/debug.log', LOG_QUIET),
    expect: ['LOG006', 'SHAPE005']
  },
  {
    id: 'LOG007',
    summary: 'A log too large to read, outside the web root.',
    build: (d) => write(d, 'logs/error.log', LOG_QUIET + 'x'.repeat(6 * 1024 * 1024)),
    expect: ['LOG007', 'SHAPE005']
  },

  // ---- interrupted updates ----------------------------------------------
  {
    id: 'UPD001',
    summary: 'The file that shows every visitor the maintenance notice.',
    build: (d) => write(d, '.maintenance', '<?php $upgrading = 1793000000; ?>\n'),
    expect: ['UPD001', 'SHAPE005']
  },
  {
    id: 'UPD002',
    summary: 'Scratch space from an update that stopped part way.',
    build: (d) => write(d, 'wp-content/upgrade/sample-plugin/sample-plugin.php', plainPhp('// extracted')),
    expect: ['UPD002', 'SHAPE005']
  },
  {
    id: 'UPD003',
    summary: 'Core modification times spread far wider than one update writes.',
    build: (d) => {
      // Spread the core files over 40 days, with version.php newest, so the
      // spread is wide but no single file sits far from the median.
      WP_INCLUDES_PHP.forEach((name, i) => {
        if (name === 'version.php') return;
        touch(d, `wp-includes/${name}`, -Math.round((40 - (i * 40) / 9) * DAY));
      });
    },
    expect: ['UPD003', 'SHAPE005']
  },
  {
    id: 'UPD004',
    summary: 'A plugin directory with no PHP entry point to load.',
    build: (d) => write(d, 'wp-content/plugins/half-extracted/readme.txt', 'Assets only.\n'),
    expect: ['UPD004', 'SHAPE005']
  },

  // ---- drop-ins and must-use --------------------------------------------
  {
    id: 'DROP001',
    summary: 'A file named like a drop-in that WordPress loads from nowhere.',
    build: (d) => write(d, 'wp-content/wp-cache-config.php', plainPhp('// looks loaded, is not')),
    expect: ['DROP001', 'SHAPE005']
  },
  {
    id: 'DROP002',
    summary: 'A drop-in WordPress does load, which is a normal thing to find.',
    build: (d) => write(d, 'wp-content/object-cache.php', plainPhp('// a cache backend')),
    expect: ['DROP002', 'SHAPE005']
  },
  {
    id: 'DROP003',
    summary: 'A must-use plugin, which loads before the admin exists.',
    build: (d) => write(d, 'wp-content/mu-plugins/health.php', plainPhp('// a health endpoint')),
    expect: ['DROP003', 'SHAPE005']
  },
  {
    id: 'DROP004',
    summary: 'A must-use loader that reaches outside its own directory.',
    build: (d) => write(d, 'wp-content/mu-plugins/loader.php',
      plainPhp("require_once '../../../opt/stage/bootstrap.php';")),
    expect: ['DROP003', 'DROP004', 'SHAPE005']
  },
  {
    id: 'DROP006',
    summary: 'A must-use loader that includes code from a writable directory.',
    build: (d) => write(d, 'wp-content/mu-plugins/warmer.php',
      plainPhp("include_once 'wp-content/uploads/cache/warm.php';")),
    expect: ['DROP003', 'DROP006', 'SHAPE005']
  },
  {
    id: 'DROP005',
    summary: 'A database drop-in with no plugin that could own it.',
    build: (d) => write(d, 'wp-content/db.php', plainPhp('// sits in front of every query')),
    expect: ['DROP002', 'DROP005', 'SHAPE005']
  },

  // ---- .htaccess --------------------------------------------------------
  {
    id: 'HTA001',
    summary: 'No rewrite file at the web root at all.',
    build: (d) => remove(d, '.htaccess'),
    expect: ['HTA001', 'SHAPE005']
  },
  {
    id: 'HTA002',
    summary: 'The uploads directory is configured to run PHP.',
    build: (d) => write(d, 'wp-content/uploads/.htaccess', 'AddHandler application/x-httpd-php .php\n'),
    expect: ['HTA002', 'SHAPE005']
  },
  {
    id: 'HTA003',
    summary: 'A file prepended to every PHP request on the site.',
    build: (d) => edit(d, '.htaccess', (t) => t + '\nphp_value auto_prepend_file /tmp/aa.php\n'),
    expect: ['HTA003', 'SHAPE005']
  },
  {
    id: 'HTA004',
    summary: 'One rule forces https while another names an http target.',
    build: (d) => edit(d, '.htaccess', (t) => t + [
      '',
      '<IfModule mod_rewrite.c>',
      'RewriteCond %{HTTPS} off',
      'RewriteRule ^(.*)$ https://example.test/$1 [R=301,L]',
      'RewriteRule ^legacy/(.*)$ http://example.test/$1 [R=301,L]',
      '</IfModule>',
      ''
    ].join('\n')),
    expect: ['HTA004', 'SHAPE005']
  },
  {
    id: 'HTA006',
    summary: 'Several host conditions rewriting in the same file.',
    build: (d) => edit(d, '.htaccess', (t) => t + [
      '',
      '<IfModule mod_rewrite.c>',
      'RewriteCond %{HTTP_HOST} ^example\\.test$ [NC]',
      'RewriteRule ^(.*)$ /$1 [L]',
      'RewriteCond %{HTTP_HOST} ^www\\.example\\.test$ [NC]',
      'RewriteRule ^(.*)$ /$1 [L]',
      '</IfModule>',
      ''
    ].join('\n')),
    expect: ['HTA006', 'SHAPE005']
  },
  {
    id: 'HTA005',
    summary: 'Two WordPress rule blocks, because the markers went missing once.',
    build: (d) => edit(d, '.htaccess', (t) => t + '\n' + t),
    expect: ['HTA005', 'SHAPE005']
  },

  // ---- output around PHP tags -------------------------------------------
  {
    id: 'OUT001',
    summary: 'A blank line before the opening tag of the theme functions file.',
    build: (d) => edit(d, 'wp-content/themes/sample-theme/functions.php', (t) => '\n' + t),
    expect: ['OUT001', 'SHAPE005']
  },
  {
    id: 'OUT002',
    summary: 'Whitespace after the closing tag of a file that is pure PHP.',
    build: (d) => write(d, 'wp-content/plugins/sample-plugin/sample-plugin.php',
      '<?php\n// Plugin Name: Sample\n?>\n\n'),
    expect: ['OUT002', 'SHAPE005']
  },
  {
    id: 'OUT003',
    summary: 'A byte order mark in front of a file that loads early.',
    build: (d) => write(d, 'wp-content/themes/sample-theme/functions.php',
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(plainPhp('// themed'), 'utf8')])),
    expect: ['OUT003', 'SHAPE005']
  },

  // ---- executables in uploads -------------------------------------------
  {
    id: 'UP001',
    summary: 'A PHP file in the media directory.',
    build: (d) => write(d, 'wp-content/uploads/2026/10/report.php', plainPhp('// not media')),
    expect: ['UP001', 'SHAPE005']
  },
  {
    id: 'UP002',
    summary: 'An alternate PHP extension in the media directory.',
    build: (d) => write(d, 'wp-content/uploads/2026/10/report.phtml', plainPhp('// not media either')),
    expect: ['UP002', 'SHAPE005']
  },
  {
    id: 'UP003',
    summary: 'A double extension in the media directory.',
    build: (d) => write(d, 'wp-content/uploads/2026/10/banner.jpg.php', plainPhp('// a bypass')),
    expect: ['UP003', 'SHAPE005']
  },
  {
    id: 'UP004',
    summary: 'A file with an image extension whose bytes are PHP.',
    build: (d) => write(d, 'wp-content/uploads/2026/10/photo.png', '<?php\n// wrong extension\n'),
    expect: ['UP004', 'SHAPE005']
  },

  // ---- obfuscation ------------------------------------------------------
  {
    id: 'OBF001',
    summary: 'Code decoded and then executed.',
    build: (d) => write(d, 'wp-content/plugins/sample-plugin/licence.php',
      plainPhp(`${EVAL}(${B64}($payload));`)),
    expect: ['OBF001', 'SHAPE005']
  },
  {
    id: 'OBF002',
    summary: 'Code decompressed and then executed.',
    build: (d) => write(d, 'wp-content/plugins/sample-plugin/licence.php',
      plainPhp(`${EVAL}(${GZ}($payload));`)),
    expect: ['OBF002', 'SHAPE005']
  },
  {
    id: 'OBF003',
    summary: 'A replacement evaluated as code by the pattern modifier.',
    build: (d) => write(d, 'wp-content/plugins/sample-plugin/legacy.php',
      plainPhp(`${PREG}('/name/e', 'strtoupper("$0")', $in);`)),
    expect: ['OBF003', 'SHAPE005']
  },
  {
    id: 'OBF004',
    summary: 'A function compiled from a string.',
    build: (d) => write(d, 'wp-content/plugins/sample-plugin/legacy.php',
      plainPhp(`$f = ${CREATE_FN}('$a', 'return $a;');`)),
    expect: ['OBF004', 'SHAPE005']
  },
  {
    id: 'OBF005',
    summary: 'A long encoded string sitting in source.',
    build: (d) => write(d, 'wp-content/plugins/sample-plugin/assets.php',
      plainPhp(`$icon = '${BLOB}';`)),
    expect: ['OBF005', 'SHAPE005']
  },
  {
    id: 'OBF006',
    summary: 'A function name split across concatenated fragments.',
    build: (d) => write(d, 'wp-content/plugins/sample-plugin/hidden.php',
      plainPhp("$fn = 'ba' . 'se64' . '_deco';")),
    expect: ['OBF006', 'SHAPE005']
  },
  {
    id: 'OBF007',
    summary: 'An assertion handed a variable, which older PHP ran as code.',
    build: (d) => write(d, 'wp-content/plugins/sample-plugin/legacy.php',
      plainPhp(`${ASSERT}($code);`)),
    expect: ['OBF007', 'SHAPE005']
  },
  {
    id: 'OBF008',
    summary: 'A single line long enough to hide a payload in.',
    build: (d) => write(d, 'wp-content/plugins/sample-plugin/generated.php',
      plainPhp('// ' + 'wp nav menu item '.repeat(130))),
    expect: ['OBF008', 'SHAPE005']
  },

  // ---- core integrity ---------------------------------------------------
  {
    id: 'CORE001',
    summary: 'A PHP file at the web root that no release ships.',
    build: (d) => write(d, 'wp-login-backup.php', plainPhp('// a copy somebody kept')),
    expect: ['CORE001', 'SHAPE005']
  },
  {
    id: 'CORE002',
    summary: 'A file inside a core directory with an extension core never ships.',
    build: (d) => write(d, 'wp-includes/functions.php.bak', plainPhp('// a copy')),
    expect: ['CORE002', 'SHAPE005']
  },
  {
    id: 'CORE005',
    summary: 'A hidden file inside a core directory.',
    build: (d) => write(d, 'wp-admin/.env', 'TOKEN=not-a-real-token\n'),
    expect: ['CORE005', 'SHAPE005']
  },
  {
    id: 'CORE003',
    summary: 'One core file written far away from the rest of core.',
    build: (d) => touch(d, 'wp-admin/admin.php', -60 * DAY),
    expect: ['CORE003', 'SHAPE005']
  },
  {
    id: 'CORE004',
    summary: 'Core files newer than the file that names the release.',
    build: (d) => touch(d, 'wp-includes/version.php', -10 * DAY),
    expect: ['CORE004', 'SHAPE005']
  },

  // ---- permissions ------------------------------------------------------
  {
    id: 'PERM001',
    summary: 'The configuration file is writable beyond its owner.',
    build: (d) => chmod(d, 'wp-config.php', 0o664),
    expect: ['PERM001', 'SHAPE005']
  },
  {
    id: 'PERM002',
    summary: 'A directory anything on the host can write to.',
    build: (d) => chmod(d, 'wp-content/uploads', 0o777),
    expect: ['PERM002', 'SHAPE005']
  },
  {
    id: 'PERM003',
    summary: 'A file anything on the host can write to.',
    build: (d) => chmod(d, 'wp-content/themes/sample-theme/style.css', 0o666),
    expect: ['PERM003', 'SHAPE005']
  },
  {
    id: 'PERM004',
    summary: 'The media directory its own owner cannot write to.',
    build: (d) => chmod(d, 'wp-content/uploads', 0o555),
    expect: ['PERM004', 'SHAPE005']
  }
];
