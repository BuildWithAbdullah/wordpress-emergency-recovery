import * as text from './text.mjs';
import * as markdown from './markdown.mjs';
import * as json from './json.mjs';

export const FORMATS = { text, markdown, json };

export function renderReport(result, format = 'text') {
  const renderer = FORMATS[format];
  if (!renderer) throw new Error(`unknown format: ${format}`);
  return renderer.render(result);
}
