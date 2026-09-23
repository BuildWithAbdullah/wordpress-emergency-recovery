import { make } from '../findings.mjs';
import { matches, lineOf, excerpt } from '../scan.mjs';

export const id = 'htaccess';
export const title = 'Apache configuration files';
export const describes = 'Directives that change how PHP runs, and rewrite rules that can send a request round in a circle.';

export function run(ctx) {
  const out = [];

  if (!ctx.has('.htaccess')) {
    out.push(make('HTA001', { file: '.htaccess' }));
  }

  const files = ctx.files.filter((f) => !f.dir && /(^|\/)\.htaccess$/.test(f.rel));
  for (const f of files) {
    const text = ctx.readText(f.rel);
    if (text === null) continue;
    const live = text
      .split('\n')
      .map((l, i) => ({ i, l }))
      .filter((r) => !/^\s*#/.test(r.l));
    const liveText = live.map((r) => r.l).join('\n');

    const inUploads = /(^|\/)uploads\//.test(f.rel) || f.rel.startsWith('wp-content/uploads');
    if (inUploads) {
      const handlers = matches(liveText, /(AddType\s+application\/x-httpd-php|AddHandler\s+[^\n]*php|SetHandler\s+[^\n]*php|php_flag\s+engine\s+on)/i, 6);
      for (const h of handlers) {
        out.push(make('HTA002', { file: f.rel, line: h.line, excerpt: h.excerpt }));
      }
    }

    for (const h of matches(liveText, /php_value\s+auto_prepend_file\s+([^\s]+)|auto_prepend_file\s*=\s*([^\s]+)/i, 6)) {
      out.push(make('HTA003', { file: f.rel, line: h.line, excerpt: h.excerpt }, {
        detail: `Prepends ${(h.groups[0] || h.groups[1] || '').trim()} to every PHP request.`
      }));
    }

    const forcesHttps = /RewriteCond\s+%\{HTTPS\}\s*(!?)\s*(=?on|off)/i.test(liveText) && /RewriteRule[^\n]*https:\/\//i.test(liveText);
    const forcesHttp = /RewriteRule[^\n]*\shttp:\/\//i.test(liveText);
    const hostRules = matches(liveText, /RewriteCond\s+%\{HTTP_HOST\}[^\n]*/gi, 8);
    if ((forcesHttps && forcesHttp) || hostRules.length >= 2) {
      const first = hostRules[0];
      out.push(make('HTA004', {
        file: f.rel,
        line: first ? first.line : 1,
        excerpt: first ? first.excerpt : excerpt(liveText, 0)
      }, {
        detail: forcesHttps && forcesHttp
          ? 'One rule forces https and another names an http target.'
          : `${hostRules.length} host conditions rewrite in the same file.`
      }));
    }

    const blocks = matches(text, /# BEGIN WordPress/g, 8);
    if (blocks.length > 1) {
      out.push(make('HTA005', { file: f.rel, line: blocks[1].line, excerpt: blocks[1].excerpt }, {
        detail: `${blocks.length} WordPress rule blocks in one file.`
      }));
    }
  }

  return out;
}
