import { make } from '../findings.mjs';

export const id = 'permissions';
export const title = 'Filesystem permissions';
export const describes = 'Modes that let something other than the site owner rewrite the site.';

const GROUP_OR_WORLD_WRITE = 0o022;
const WORLD_WRITE = 0o002;
const OWNER_WRITE = 0o200;

export function octal(mode) {
  return '0' + (mode & 0o7777).toString(8).padStart(3, '0');
}

export function run(ctx) {
  const out = [];
  const config = ctx.get('wp-config.php');

  if (config && (config.mode & GROUP_OR_WORLD_WRITE)) {
    out.push(make('PERM001', { file: 'wp-config.php', excerpt: `mode ${octal(config.mode)}` }));
  }

  let dirHits = 0;
  let fileHits = 0;
  for (const f of ctx.files) {
    if (f.rel === 'wp-config.php') continue;
    if (f.dir) {
      if ((f.mode & WORLD_WRITE) && dirHits < 25) {
        dirHits += 1;
        out.push(make('PERM002', { file: f.rel, excerpt: `mode ${octal(f.mode)}` }));
      }
    } else if ((f.mode & WORLD_WRITE) && fileHits < 25) {
      fileHits += 1;
      out.push(make('PERM003', { file: f.rel, excerpt: `mode ${octal(f.mode)}` }));
    }
  }

  const uploads = ctx.get('wp-content/uploads');
  if (uploads && uploads.dir && !(uploads.mode & OWNER_WRITE)) {
    out.push(make('PERM004', { file: 'wp-content/uploads', excerpt: `mode ${octal(uploads.mode)}` }));
  }

  return out;
}
