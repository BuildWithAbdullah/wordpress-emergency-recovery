import { make } from '../findings.mjs';
import { lineOf, excerpt } from '../scan.mjs';

export const id = 'updates';
export const title = 'Interrupted updates';
export const describes = 'The debris an update leaves behind when it stops half way, which is the most common cause of a site that was fine an hour ago.';

export function run(ctx) {
  const out = [];

  if (ctx.has('.maintenance')) {
    const text = ctx.readText('.maintenance') || '';
    const m = text.match(/\$upgrading\s*=\s*(\d+)/);
    let detail = 'WordPress writes this file at the start of an update and removes it at the end.';
    if (m) {
      const when = new Date(Number(m[1]) * 1000);
      detail += ` Timestamp inside the file is ${when.toISOString()}.`;
    }
    out.push(make('UPD001', { file: '.maintenance', line: m ? lineOf(text, m.index) : 1, excerpt: text.trim().slice(0, 120) }, { detail }));
  }

  const upgrade = ctx.under('wp-content/upgrade').filter((f) => f.rel !== 'wp-content/upgrade');
  if (upgrade.length > 0) {
    const names = [...new Set(upgrade.map((f) => f.rel.split('/')[2]).filter(Boolean))];
    out.push(make('UPD002', { file: 'wp-content/upgrade' }, {
      detail: `Contains ${upgrade.length} entr(ies): ${names.slice(0, 6).join(', ')}.`
    }));
  }

  // Version skew. Core files are written in one pass during an update, so a
  // wide spread of modification times across wp-includes is worth a look.
  const coreFiles = ctx.under('wp-includes').filter((f) => !f.dir && f.rel.endsWith('.php'));
  if (coreFiles.length >= 8) {
    const times = coreFiles.map((f) => f.mtimeMs).sort((a, b) => a - b);
    const spreadDays = (times[times.length - 1] - times[0]) / 86400000;
    if (spreadDays > 30) {
      out.push(make('UPD003', { file: 'wp-includes' }, {
        detail: `Modification times across ${coreFiles.length} core files span ${Math.round(spreadDays)} days.`
      }));
    }
  }

  for (const kind of ['plugins', 'themes']) {
    const base = `wp-content/${kind}`;
    if (!ctx.isDir(base)) continue;
    const dirs = ctx.under(base).filter((f) => f.dir && f.rel.split('/').length === 3);
    for (const d of dirs) {
      const inside = ctx.under(d.rel).filter((f) => !f.dir);
      if (inside.length === 0) continue;
      const hasPhp = inside.some((f) => f.rel.endsWith('.php'));
      if (!hasPhp) {
        out.push(make('UPD004', { file: d.rel }, {
          detail: `${inside.length} file(s) present, none of them PHP.`
        }));
      }
    }
  }

  return out;
}
