import { make } from '../findings.mjs';
import { matches, lineOf, excerpt } from '../scan.mjs';

export const id = 'htaccess';
export const title = 'Apache configuration files';
export const describes = 'Directives that change how PHP runs, and rewrite rules that can send a request round in a circle.';

// Comment lines have to come out before the directives are read, because a
// commented out handler is not a handler. Dropping them renumbers the file,
// though, and a finding whose line number is a line in a string nobody can
// open is worse than one with no line number at all. So the stripped text
// carries a map back to the real line, and every finding is reported against
// the file as it sits on disk.
export function liveLines(text) {
  const map = [];
  const kept = [];
  text.split('\n').forEach((line, i) => {
    if (/^\s*#/.test(line)) return;
    map.push(i + 1);
    kept.push(line);
  });
  return { text: kept.join('\n'), map };
}

export function run(ctx) {
  const out = [];

  if (!ctx.has('.htaccess')) {
    out.push(make('HTA001', { file: '.htaccess' }));
  }

  const files = ctx.files.filter((f) => !f.dir && /(^|\/)\.htaccess$/.test(f.rel));
  for (const f of files) {
    const text = ctx.readText(f.rel);
    if (text === null) continue;
    const live = liveLines(text);
    const liveText = live.text;
    // A hit found in the stripped text, reported against the real file.
    const real = (hit) => ({
      file: f.rel,
      line: live.map[hit.line - 1] || hit.line,
      excerpt: hit.excerpt
    });

    const inUploads = /(^|\/)uploads\//.test(f.rel) || f.rel.startsWith('wp-content/uploads');
    if (inUploads) {
      const handlers = matches(liveText, /(AddType\s+application\/x-httpd-php|AddHandler\s+[^\n]*php|SetHandler\s+[^\n]*php|php_flag\s+engine\s+on)/i, 6);
      for (const h of handlers) {
        out.push(make('HTA002', real(h)));
      }
    }

    for (const h of matches(liveText, /php_value\s+auto_prepend_file\s+([^\s]+)|auto_prepend_file\s*=\s*([^\s]+)/i, 6)) {
      out.push(make('HTA003', real(h), {
        detail: `Prepends ${(h.groups[0] || h.groups[1] || '').trim()} to every PHP request.`
      }));
    }

    // Two reasons a file can build a loop, and they are not the same reason.
    // A scheme forced one way and an http target named the other is a pair
    // of rules that undo each other, and the fix is to decide both in one
    // rule. Several host conditions is a weaker signal with a different fix:
    // read them in order and find which host the request lands on. They were
    // one finding, which meant the next action was right for one of them.
    const forcesHttps = /RewriteCond\s+%\{HTTPS\}\s*(!?)\s*(=?on|off)/i.test(liveText) && /RewriteRule[^\n]*https:\/\//i.test(liveText);
    const forcesHttp = /RewriteRule[^\n]*\shttp:\/\//i.test(liveText);
    const hostRules = matches(liveText, /RewriteCond\s+%\{HTTP_HOST\}[^\n]*/gi, 8);

    if (forcesHttps && forcesHttp) {
      const scheme = matches(liveText, /RewriteCond\s+%\{HTTPS\}[^\n]*/i, 1)[0];
      out.push(make('HTA004', scheme ? real(scheme) : { file: f.rel, line: 1, excerpt: excerpt(liveText, 0) }, {
        detail: 'One rule forces https and another names an http target.'
      }));
    } else if (hostRules.length >= 2) {
      out.push(make('HTA006', real(hostRules[0]), {
        detail: `${hostRules.length} host conditions rewrite in the same file.`
      }));
    }

    // The WordPress markers are comments, so this one reads the real text.
    const blocks = matches(text, /# BEGIN WordPress/g, 8);
    if (blocks.length > 1) {
      out.push(make('HTA005', { file: f.rel, line: blocks[1].line, excerpt: blocks[1].excerpt }, {
        detail: `${blocks.length} WordPress rule blocks in one file.`
      }));
    }
  }

  return out;
}
