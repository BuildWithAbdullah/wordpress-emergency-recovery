# wordpress-emergency-recovery

A WordPress site is down, or behaving strangely, and somebody needs an answer
in the next twenty minutes. This repository holds the two things that make that
go well: a read-only tool that tells you what the install actually looks like,
and the decision trees that turn a symptom into the next thing to check.

`wp-triage` reads a WordPress install from the filesystem and reports what it
finds. It never writes to the install, never opens a database connection, and
never makes a network request, which is what makes it safe to run before you
have decided anything. Those three claims are asserted in CI rather than
promised here: see [Verifying](#verifying).

Every finding carries three things:

- **where**, with a file and a line number
- **the next action**, because a finding with no next step is just anxiety
- **what it does not prove**, because that is the part that stops a responder
  escalating on a must-use plugin that turned out to be the host's

There is no score and no grade. A responder wants a list of places to look.

## Install

No dependencies, and nothing to install if you have Node 18 or newer.

```bash
npx wp-triage /var/www/site
```

Or clone it:

```bash
git clone https://github.com/BuildWithAbdullah/wordpress-emergency-recovery
node wordpress-emergency-recovery/bin/wp-triage.mjs /var/www/site
```

## Usage

```
wp-triage <path-to-wordpress-root> [options]

  --format <text|markdown|json>  Report format. Default text.
  --only <ids>                   Comma separated check ids to run.
  --skip <ids>                   Comma separated check ids to skip.
  --fail-on <severity>           Exit 1 at this severity or above. Default high.
  --list-checks                  Print the check modules and exit.
  --list-findings                Print the finding catalogue and exit.
```

Exit codes make it usable from a pipeline: `0` when nothing reaches the
threshold, `1` when something does, `2` when the run could not complete.

```bash
# The report you paste into an incident channel
wp-triage /var/www/site --format markdown > triage.md

# Just the questions worth asking during an intrusion
wp-triage /var/www/site --only uploads,dropins,obfuscation,core

# In CI, fail the build on anything critical
wp-triage ./site --fail-on critical
```

### What a report looks like

```
  1. [CRITICAL] UP003  Double extension inside uploads
     where        wp-content/uploads/holiday-banner.jpg.php
     next action  A name ending in .jpg.php is a bypass for filters
                  that only read the first extension. Preserve and
                  remove.
     not proof of It does not prove the upload filter was bypassed. The
                  file may have been placed by a different route
                  entirely.
```

## The checks

58 findings across 11 check modules.

| Check | What it looks at |
|---|---|
| `shape` | Whether this is a WordPress root at all, and which release it claims to be |
| `config` | Constants that decide how errors surface, where logs land, what secrets are in use |
| `logs` | Fatal errors, memory ceilings and early output the install already recorded |
| `updates` | The debris an interrupted update leaves behind |
| `dropins` | Code that loads before the plugins screen exists and cannot be switched off there |
| `htaccess` | Directives that change how PHP runs, and rules that redirect in a circle |
| `output` | The invisible bytes that break redirects, cookies and logins |
| `uploads` | Files in the media directory that are not media |
| `obfuscation` | Shapes that hide what code does |
| `core` | Files where core does not expect them, timestamps out of step with the release |
| `permissions` | Modes that let something other than the site owner rewrite the site |

`wp-triage --list-findings` prints the full catalogue.

## Symptom to cause

Start from what the site is doing, not from what you suspect.

| Symptom | Page |
|---|---|
| Blank page, nothing logged | [white-screen.md](docs/symptoms/white-screen.md) |
| HTTP 500 | [http-500.md](docs/symptoms/http-500.md) |
| Error establishing a database connection | [database-connection-error.md](docs/symptoms/database-connection-error.md) |
| Too many redirects | [redirect-loop.md](docs/symptoms/redirect-loop.md) |
| Allowed memory size exhausted | [memory-exhaustion.md](docs/symptoms/memory-exhaustion.md) |
| Briefly unavailable for scheduled maintenance | [stuck-in-maintenance-mode.md](docs/symptoms/stuck-in-maintenance-mode.md) |
| Cannot get into the admin | [locked-out-of-admin.md](docs/symptoms/locked-out-of-admin.md) |
| Suspected compromise | [hacked-site.md](docs/symptoms/hacked-site.md) |

Two more, and the first one is the one that matters most:

- [before-you-touch-anything.md](docs/before-you-touch-anything.md). The first
  ten minutes decide whether the rest is recoverable.
- [recovery-log-template.md](docs/recovery-log-template.md). Filled in as you
  go, it is a record. Filled in afterwards, it is a reconstruction.

## Examples

[`examples/`](examples) holds nine pairs: a failing install, and the corrected
one beside it. Both sides are overlaid onto a small clean baseline, so each
pair contains only the files that actually differ.

| Pair | Finding |
|---|---|
| [`debug-display-on`](examples/debug-display-on) | CONFIG001 |
| [`maintenance-file-left-behind`](examples/maintenance-file-left-behind) | UPD001 |
| [`uploads-php-shell`](examples/uploads-php-shell) | UP003 |
| [`uploads-htaccess-php-handler`](examples/uploads-htaccess-php-handler) | HTA002 |
| [`output-before-open-tag`](examples/output-before-open-tag) | OUT001 |
| [`obfuscated-mu-loader`](examples/obfuscated-mu-loader) | DROP003, OBF001 |
| [`unknown-dropin`](examples/unknown-dropin) | DROP001 |
| [`htaccess-redirect-loop`](examples/htaccess-redirect-loop) | HTA004 |
| [`rogue-root-php`](examples/rogue-root-php) | CORE001 |

CI runs wp-triage over both sides of every pair and asserts the finding appears
on one and not the other. It also asserts that no corrected example trips any
*other* pair's finding, which is the check that catches a fix shipped with
somebody else's defect in it.

Fixtures shaped like malware exit on their first statement and keep the flagged
text inside a string literal or a comment. `npm run verify` asserts that
mechanically rather than trusting the comment. Nothing in this repository runs.

## Verifying

```bash
npm test      # 168 tests
npm run verify # assertions about the repository itself
npm run check  # both
```

The three claims at the top of this file are tested, not asserted:

- **Never writes to the install.** `test/readonly.mjs` reads the source of
  every file under `src/` and `bin/` and fails if any of them calls a
  filesystem write API, and separately snapshots an install byte for byte,
  runs a full triage over it, and asserts nothing changed.
- **Never opens a database connection.** The same test fails the build if any
  source file so much as mentions a database driver.
- **Never makes a network request.** The same test fails the build if any
  source file imports a network module, calls `fetch`, or spawns a process.

`npm run verify` checks the repository rather than the code: that every
catalogue entry states what it does not prove, that every finding id raised in
`src/` exists in the catalogue and every catalogue entry is reachable, that the
counts printed in this README are the counts the code produces, that every
internal link resolves, that every symptom page says what it does not cover,
that every test file is named in the test script, and that no file contains a
dash character that should be plain text.

CI runs the suite on Node 18, 20 and 22.

## What it does not tell you

This is the section worth reading before trusting anything above it, and there
is a longer version in [docs/limits.md](docs/limits.md).

wp-triage reads the filesystem and nothing else. It cannot see the database, so
injected options, scheduled tasks, an extra administrator account and post
content are all outside it, and a large share of real WordPress compromises
live entirely there. It cannot see server configuration, so it does not know
whether Apache really executes PHP in uploads or whether `.htaccess` is read at
all. It has no signature list, so it finds shapes rather than known families
and cannot tell a commercial plugin's obfuscated licence check from an
injection. Timestamp findings are weak evidence, because copying, restoring and
syncing all rewrite them without changing a byte.

It reports things that are frequently benign, on purpose. A tool used during an
incident that stays quiet to look accurate is worse than useless, which is why
every finding states what it does not prove and why there is no score.

A clean report means these checks found nothing. It is not a statement that the
site is clean, and it is not something to forward to a client as an all clear.

## Licence

MIT. No attribution required.
