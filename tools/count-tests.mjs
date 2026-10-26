#!/usr/bin/env node
// Counts the tests that actually pass, from the structured event stream
// node:test emits rather than from the text its reporters print.
//
// The reporters are not a stable interface. The same suite prints
// `# pass 168` on one Node line and a spec reporter `pass 168` on another,
// so a verifier that parses reporter output reports the wrong number or no
// number at all depending on which Node is running it. run() gives the
// events directly and they are the same on every version.
//
// Two traps live in here, both of them silent:
//
//   An object stream only flows once something reads it, and attaching
//   named-event listeners does not count as reading it. So it is consumed
//   with for await, and a run that yields no events at all would otherwise
//   report zero tests and pass.
//
//   run({ files: [aDirectory] }) is not the same as `node --test aDirectory`.
//   It resolves the path as a module and throws MODULE_NOT_FOUND. The files
//   are enumerated here and passed as a list.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function testFiles(root = repoRoot) {
  const dir = path.join(root, 'test');
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.mjs') && f !== 'helpers.mjs' && f !== 'corpus.mjs')
    .sort()
    .map((f) => path.join(dir, f));
}

export async function countTests(root = repoRoot) {
  const files = testFiles(root);
  if (files.length === 0) throw new Error('no test files found');

  const stream = run({ files, concurrency: 1 });
  let pass = 0;
  let fail = 0;

  for await (const event of stream) {
    if (event.type === 'test:pass') pass += 1;
    else if (event.type === 'test:fail') fail += 1;
  }

  // Zero is the number a broken harness produces, so it is an error here
  // rather than a result.
  if (pass + fail === 0) throw new Error('the test runner produced no results');
  return { pass, fail, files: files.length };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { pass, fail, files } = await countTests();
  process.stderr.write(`${pass} passed, ${fail} failed, across ${files} files\n`);
  process.stdout.write(`${pass}\n`);
  process.exit(fail === 0 ? 0 : 1);
}
