import { make } from '../findings.mjs';
import { lineOf, excerpt, matches } from '../scan.mjs';

export const id = 'shape';
export const title = 'Install shape';
export const describes = 'Whether this directory is a WordPress root at all, and which release it claims to be.';

export function run(ctx) {
  const out = [];

  if (!ctx.has('wp-config.php')) {
    out.push(make('SHAPE001', { file: 'wp-config.php' }, {
      detail: 'Also check one directory above the web root, which is a supported location.'
    }));
  }

  const version = ctx.readText('wp-includes/version.php');
  if (!ctx.has('wp-includes/version.php')) {
    out.push(make('SHAPE002', { file: 'wp-includes/version.php' }));
  } else if (version) {
    const m = version.match(/\$wp_version\s*=\s*'([^']+)'/);
    if (m) {
      out.push(make('SHAPE005', {
        file: 'wp-includes/version.php',
        line: lineOf(version, m.index),
        excerpt: excerpt(version, m.index)
      }, { detail: `Reported version ${m[1]}.` }));
    }
  }

  if (!ctx.isDir('wp-content')) {
    out.push(make('SHAPE003', { file: 'wp-content' }));
  }

  const index = ctx.readText('index.php');
  if (index !== null && !/wp-blog-header\.php/.test(index)) {
    const hit = matches(index, /require|include/i, 1)[0];
    out.push(make('SHAPE004', {
      file: 'index.php',
      line: hit ? hit.line : 1,
      excerpt: hit ? hit.excerpt : excerpt(index, 0)
    }));
  }

  return out;
}
