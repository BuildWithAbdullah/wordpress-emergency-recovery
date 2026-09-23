import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, buildInstall, examplesDir, run } from './helpers.mjs';

// The README claims wp-triage never writes to the install, never opens a
// database connection and never makes a network request. These tests are what
// make that claim checkable rather than a promise.

function sourceFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.mjs')) out.push(p);
    }
  };
  walk(path.join(repoRoot, 'src'));
  walk(path.join(repoRoot, 'bin'));
  return out;
}

const WRITE_APIS = /\bfs\.(write|append|mkdir|rm|rmdir|unlink|copy|rename|chmod|chown|truncate|createWriteStream|utimes|link|symlink)\w*\s*\(/;
const NETWORK_MODULES = /from\s+['"]node:(http|https|net|tls|dgram|dns)['"]|require\(['"]node:(http|https|net|tls|dgram|dns)['"]\)/;
const FETCH = /\bfetch\s*\(|\bXMLHttpRequest\b/;
const CHILD = /child_process|execSync|spawnSync/;

test('no file under src or bin calls a filesystem write API', () => {
  for (const file of sourceFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    const hit = text.match(WRITE_APIS);
    assert.equal(hit, null, `${path.relative(repoRoot, file)} calls ${hit && hit[0]}`);
  }
});

test('every file handle opened under src is opened for reading only', () => {
  for (const file of sourceFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/fs\.open\w*\s*\(([^)]*)\)/g)) {
      assert.match(m[1], /,\s*'r'\s*$/, `${path.relative(repoRoot, file)} opens a handle without an explicit read-only flag: ${m[0]}`);
    }
  }
});

test('no file under src or bin imports a network module or calls fetch', () => {
  for (const file of sourceFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(text.match(NETWORK_MODULES), null, `${path.relative(repoRoot, file)} imports a network module`);
    assert.equal(text.match(FETCH), null, `${path.relative(repoRoot, file)} calls fetch`);
  }
});

test('no file under src or bin shells out', () => {
  for (const file of sourceFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(text.match(CHILD), null, `${path.relative(repoRoot, file)} spawns a process`);
  }
});

test('nothing in src mentions a database driver', () => {
  for (const file of sourceFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(text.match(/mysql|mysqli|mariadb|\bPDO\b/i), null, `${path.relative(repoRoot, file)} mentions a database driver`);
  }
});

// The claim tested behaviourally as well as by reading the source.
test('a full run leaves the install byte for byte identical', () => {
  const dir = buildInstall(path.join(examplesDir, 'uploads-php-shell', 'fail'), 'readonly');

  const snapshot = () => {
    const rows = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { rows.push(`D ${path.relative(dir, p)}`); walk(p); }
        else {
          const st = fs.statSync(p);
          rows.push(`F ${path.relative(dir, p)} ${st.size} ${st.mtimeMs} ${st.mode} ${fs.readFileSync(p, 'utf8').length}`);
        }
      }
    };
    walk(dir);
    return rows.join('\n');
  };

  const before = snapshot();
  const result = run(dir);
  assert.ok(result.findings.length > 0, 'the run should have done real work');
  assert.equal(snapshot(), before, 'the install changed during a run');
});

test('a run on a directory the process cannot read does not throw', () => {
  const dir = buildInstall(null, 'readonly-perm');
  const locked = path.join(dir, 'wp-content/locked');
  fs.mkdirSync(locked);
  fs.writeFileSync(path.join(locked, 'a.php'), '<?php\n');
  fs.chmodSync(locked, 0o000);
  let result;
  try {
    result = run(dir);
  } finally {
    fs.chmodSync(locked, 0o755);
  }
  assert.deepEqual(result.checkErrors, []);
});
