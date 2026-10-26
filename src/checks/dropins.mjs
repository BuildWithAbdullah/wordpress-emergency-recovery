import { make } from '../findings.mjs';
import { matches } from '../scan.mjs';

export const id = 'dropins';
export const title = 'Drop-ins and must-use plugins';
export const describes = 'Code that loads before the plugin screen exists, and therefore cannot be switched off from the admin.';

// The filenames WordPress actually loads from wp-content.
export const KNOWN_DROPINS = new Set([
  'advanced-cache.php',
  'db.php',
  'db-error.php',
  'install.php',
  'maintenance.php',
  'object-cache.php',
  'php-error.php',
  'fatal-error-handler.php',
  'sunrise.php',
  'blog-deleted.php',
  'blog-inactive.php',
  'blog-suspended.php'
]);

// Where an include points, which decides which finding it is.
const WRITABLE = /(^|\/)(uploads|cache|tmp|temp)(\/|$)/i;
const ESCAPES = /\.\.\//;

// Names that look like a drop-in but are loaded by nothing.
const SUSPICIOUS_SHAPE = /^(wp-|_|\.)|cache|config|class|core|init|load|index2|admin/i;

export function run(ctx) {
  const out = [];

  const top = ctx.under('wp-content').filter((f) => !f.dir && f.rel.split('/').length === 2 && f.rel.endsWith('.php'));
  for (const f of top) {
    const name = f.rel.split('/')[1];
    if (KNOWN_DROPINS.has(name)) {
      out.push(make('DROP002', { file: f.rel }, { detail: `${name} is a drop-in WordPress loads automatically.` }));
      if (name === 'db.php') {
        const pluginDirs = ctx.under('wp-content/plugins').filter((p) => p.dir && p.rel.split('/').length === 3);
        const owned = pluginDirs.some((p) => /cache|query|database|db|hyperdb|litespeed/i.test(p.rel));
        if (!owned) out.push(make('DROP005', { file: f.rel }, { detail: `${pluginDirs.length} plugin director(ies) present, none of which look like the owner.` }));
      }
    } else if (SUSPICIOUS_SHAPE.test(name)) {
      out.push(make('DROP001', { file: f.rel }, {
        detail: `${name} is not one of the ${KNOWN_DROPINS.size} filenames WordPress loads from wp-content.`
      }));
    }
  }

  const mu = ctx.under('wp-content/mu-plugins').filter((f) => !f.dir && f.rel.endsWith('.php'));
  for (const f of mu) {
    out.push(make('DROP003', { file: f.rel }));
    const text = ctx.readText(f.rel);
    if (text === null) continue;
    const includes = matches(text, /(?:require|include)(?:_once)?\s*\(?\s*['"]([^'"]+)['"]/g, 8);
    for (const inc of includes) {
      const target = inc.groups[0] || '';
      // Two reasons, and the second is worse. A path that leaves the
      // directory means the code stays active after mu-plugins is cleaned.
      // A path into a directory the web server can write means the code can
      // be replaced at will, so cleaning the target fixes nothing either.
      // Reported separately because the second one is not finished until the
      // write access is closed too.
      if (WRITABLE.test(target)) {
        out.push(make('DROP006', { file: f.rel, line: inc.line, excerpt: inc.excerpt }, {
          detail: `Includes ${target}, which is a directory the site writes to.`
        }));
      } else if (ESCAPES.test(target)) {
        out.push(make('DROP004', { file: f.rel, line: inc.line, excerpt: inc.excerpt }, {
          detail: `Includes ${target}, which resolves outside mu-plugins.`
        }));
      }
    }
  }

  return out;
}
