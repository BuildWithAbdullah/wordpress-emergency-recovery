import { make } from '../findings.mjs';

export const id = 'core';
export const title = 'Core integrity signals';
export const describes = 'Files where core does not expect them, and timestamps that do not match the rest of the release.';

// The PHP files a stock WordPress release puts at the web root.
export const ROOT_PHP = new Set([
  'index.php',
  'wp-activate.php',
  'wp-blog-header.php',
  'wp-comments-post.php',
  'wp-config.php',
  'wp-config-sample.php',
  'wp-cron.php',
  'wp-links-opml.php',
  'wp-load.php',
  'wp-login.php',
  'wp-mail.php',
  'wp-settings.php',
  'wp-signup.php',
  'wp-trackback.php',
  'xmlrpc.php'
]);

const CORE_DIRS = ['wp-admin', 'wp-includes'];
const CORE_DIR_EXT = /\.(php|js|css|html?|po|mo|json|txt|xml|svg|png|gif|jpe?g|woff2?|ttf|eot|map|dtd|ent|crt|pem)$/i;
const DAY = 86400000;

export function run(ctx) {
  const out = [];

  for (const f of ctx.files) {
    if (f.dir || f.rel.includes('/')) continue;
    if (!/\.php$/i.test(f.rel)) continue;
    if (ROOT_PHP.has(f.rel)) continue;
    out.push(make('CORE001', { file: f.rel }, { detail: `${f.size} bytes at the web root.` }));
  }

  // Files in core directories that carry an extension core never ships.
  for (const dir of CORE_DIRS) {
    if (!ctx.isDir(dir)) continue;
    for (const f of ctx.under(dir)) {
      if (f.dir) continue;
      const base = f.rel.split('/').pop();
      if (!CORE_DIR_EXT.test(base) || /^\./.test(base)) {
        out.push(make('CORE002', { file: f.rel }, { detail: `${f.size} bytes inside a core directory.` }));
      }
    }
  }

  const version = ctx.get('wp-includes/version.php');
  const coreFiles = [];
  for (const dir of CORE_DIRS) {
    for (const f of ctx.under(dir)) {
      if (!f.dir && /\.php$/i.test(f.rel)) coreFiles.push(f);
    }
  }

  if (coreFiles.length >= 8) {
    const times = coreFiles.map((f) => f.mtimeMs).slice().sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    for (const f of coreFiles) {
      if (Math.abs(f.mtimeMs - median) > 30 * DAY) {
        out.push(make('CORE003', { file: f.rel }, {
          detail: `Modified ${Math.round((f.mtimeMs - median) / DAY)} day(s) from the median of ${coreFiles.length} core files.`
        }));
      }
    }
  }

  if (version) {
    for (const f of coreFiles) {
      if (f.mtimeMs > version.mtimeMs + DAY) {
        out.push(make('CORE004', { file: f.rel }, {
          detail: `Newer than version.php by ${Math.round((f.mtimeMs - version.mtimeMs) / DAY)} day(s).`
        }));
      }
    }
  }

  return out;
}
