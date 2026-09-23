import { make } from '../findings.mjs';

export const id = 'uploads';
export const title = 'Executables in uploads';
export const describes = 'Files in the media directory that are not media. Nothing in WordPress writes PHP here.';

const ALT_PHP = /\.(phtml|php[3457]|phps|phar|pht|shtml)$/i;
const IMAGE = /\.(jpe?g|png|gif|webp|svg|bmp|ico|avif)$/i;
const DOUBLE = /\.(jpe?g|png|gif|webp|pdf|zip|doc|docx|txt|csv|mp4)\.(php\d?|phtml|phar|pht)$/i;

export function run(ctx) {
  const out = [];
  const roots = ['wp-content/uploads'];
  for (const f of ctx.files) {
    if (f.dir && /(^|\/)uploads$/.test(f.rel) && !roots.includes(f.rel)) roots.push(f.rel);
  }

  for (const root of roots) {
    if (!ctx.isDir(root)) continue;
    for (const f of ctx.under(root)) {
      if (f.dir) continue;

      if (DOUBLE.test(f.rel)) {
        out.push(make('UP003', { file: f.rel }));
        continue;
      }
      if (/\.php$/i.test(f.rel)) {
        // An index.php that holds nothing but a silence comment is the
        // standard directory listing guard, not a finding.
        const text = ctx.readText(f.rel) || '';
        if (/(^|\/)index\.php$/i.test(f.rel) && /Silence is golden/i.test(text) && text.length < 200) continue;
        out.push(make('UP001', { file: f.rel }, { detail: `${f.size} bytes.` }));
        continue;
      }
      if (ALT_PHP.test(f.rel)) {
        out.push(make('UP002', { file: f.rel }, { detail: `${f.size} bytes.` }));
        continue;
      }
      if (IMAGE.test(f.rel)) {
        const head = ctx.readBytes(f.rel, 32);
        if (head && head.toString('latin1').includes('<?php')) {
          out.push(make('UP004', { file: f.rel, line: 1, excerpt: '<?php in the first 32 bytes' }));
        }
      }
    }
  }

  return out;
}
