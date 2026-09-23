import { make } from '../findings.mjs';

export const id = 'output';
export const title = 'Output around PHP tags';
export const describes = 'The invisible bytes that break redirects, cookies and logins, and that no editor shows you.';

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

// Checking every PHP file in a large install is wasteful. These are the files
// that load early enough for stray output to matter.
const PRIORITY = [
  /^wp-config\.php$/,
  /^index\.php$/,
  /^wp-load\.php$/,
  /^wp-settings\.php$/,
  /^wp-blog-header\.php$/,
  /^wp-content\/[^/]+\.php$/,
  /^wp-content\/mu-plugins\//,
  /^wp-content\/themes\/[^/]+\/functions\.php$/,
  /^wp-content\/plugins\/[^/]+\/[^/]+\.php$/
];

export function isPriority(rel) {
  return PRIORITY.some((re) => re.test(rel));
}

export function run(ctx) {
  const out = [];
  const targets = ctx.phpFiles().filter((f) => isPriority(f.rel));

  for (const f of targets) {
    const head = ctx.readBytes(f.rel, 3);
    if (head && head.length === 3 && head.equals(BOM)) {
      out.push(make('OUT003', { file: f.rel, line: 1, excerpt: 'EF BB BF' }));
    }

    const text = ctx.readText(f.rel);
    if (text === null) continue;

    const open = text.indexOf('<?php');
    if (open > 0) {
      const before = text.slice(0, open);
      const isOnlyBom = /^﻿$/.test(before);
      if (!isOnlyBom && f.rel !== 'wp-config.php') {
        out.push(make('OUT001', { file: f.rel, line: 1, excerpt: JSON.stringify(before.slice(0, 40)) }, {
          detail: `${before.length} byte(s) before the opening tag.`
        }));
      }
    }

    // Only files that are one uninterrupted PHP block. A template that
    // deliberately drops in and out of PHP ends with a closing tag by design,
    // and its trailing newline is markup, not a mistake.
    const openTags = (text.match(/<\?(php|=)/g) || []).length;
    const close = text.lastIndexOf('?>');
    if (openTags === 1 && close !== -1) {
      const after = text.slice(close + 2);
      if (after.length > 0) {
        out.push(make('OUT002', { file: f.rel, line: text.slice(0, close).split('\n').length, excerpt: JSON.stringify(after.slice(0, 40)) }, {
          detail: `${after.length} byte(s) after the final closing tag.`
        }));
      }
    }
  }

  return out;
}
