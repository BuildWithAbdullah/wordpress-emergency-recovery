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

No dependencies. Clone it and run it with Node 20.0.0 or newer. That floor is
an exact version rather than a major, and CI runs a job on exactly it, because
a job named `20` resolves to the newest release of that line and a floor is
the oldest one.

```bash
git clone https://github.com/BuildWithAbdullah/wordpress-emergency-recovery
node wordpress-emergency-recovery/bin/wp-triage.mjs /var/www/site
```

This is not published to the npm registry, so there is no `npx wp-triage`. An
earlier version of this README said there was. If you ran that command and got
something, you got somebody else's package.

## Usage

```
wp-triage <path-to-wordpress-root> [options]

  --format <text|markdown|json>  Report format. Default text.
  --only <ids>                   Comma separated check ids to run.
  --skip <ids>                   Comma separated check ids to skip.
  --fail-on <severity>           Exit 1 at this severity or above. Default high.
  --list-checks                  Print the check modules and exit.
  --list-findings                Print the finding catalogue and exit.
  --limits                       Print what this tool cannot see and exit.
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

63 findings across 11 check modules, and the catalogue is one entry
per reason rather than one per check. Two checks that fire for the same reason
share an id; one check that fires for two reasons has two, because the two
reasons have different next actions and a reader who gets the wrong one is
sent to read the wrong file.

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

`wp-triage --list-findings` prints the full catalogue and
`wp-triage --limits` prints what the tool cannot see.

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

[`examples/`](examples) holds twelve pairs: a failing install, and the
corrected one beside it. Both sides are overlaid onto a small clean baseline,
so each pair contains only the files that actually differ.

The **residual** column is the part worth reading. It is the exact set of
findings that are still reported once the defect is corrected, and it is
asserted in both directions: everything else the failing side reported has to
be gone, and everything listed here has to still be there. A corrected example
that silently clears a finding it was never supposed to clear fails the build,
and so does one that leaves behind something undeclared.

| Pair | Reported on the failing side | Residual after the fix |
|---|---|---|
| [`debug-display-on`](examples/debug-display-on) | CONFIG001 | none |
| [`debug-log-in-web-root`](examples/debug-log-in-web-root) | CONFIG002, LOG002, LOG006 | none |
| [`maintenance-file-left-behind`](examples/maintenance-file-left-behind) | UPD001 | none |
| [`uploads-php-shell`](examples/uploads-php-shell) | UP003, OBF001 | none |
| [`uploads-htaccess-php-handler`](examples/uploads-htaccess-php-handler) | HTA002 | none |
| [`output-before-open-tag`](examples/output-before-open-tag) | OUT001 | none |
| [`obfuscated-mu-loader`](examples/obfuscated-mu-loader) | DROP003, OBF001 | DROP003 |
| [`mu-loader-from-uploads`](examples/mu-loader-from-uploads) | DROP003, DROP006 | DROP003 |
| [`unknown-dropin`](examples/unknown-dropin) | DROP001 | DROP002 |
| [`htaccess-redirect-loop`](examples/htaccess-redirect-loop) | HTA004 | none |
| [`canonical-host-rules`](examples/canonical-host-rules) | HTA006 | none |
| [`rogue-root-php`](examples/rogue-root-php) | CORE001 | none |

Every set in that table is exact. `SHAPE005`, which reports the release the
install claims to be, is on both sides of every pair and is left out of the
table for readability; the manifest lists it.

CI runs the real command line tool over both sides of every pair and checks the
exit code against the one the manifest implies, which is not the same claim as
the library reporting the right findings. One pair exits `0` on its failing
side, because `HTA006` is a medium severity finding and the default threshold
is high; that is asserted too, along with the fact that `--fail-on medium`
catches it. CI also asserts that no corrected example trips any *other* pair's
finding, which is the check that catches a fix shipped with somebody else's
defect in it.

Fixtures shaped like malware exit on their first statement and keep the flagged
text inside a string literal or a comment. `npm run verify` asserts that
mechanically rather than trusting the comment. Nothing in this repository runs.

## The fixture corpus

The twelve pairs above reach 17 of the 63 catalogued findings.
That is the honest number and it is asserted, not estimated.

The reason is that a pair has to be a plausible broken install that a reader
recognises, and most of the catalogue is not plausible on its own: nobody ships
an install whose only defect is a default table prefix. So the rest of the
evidence is [`test/corpus.mjs`](test/corpus.mjs), which holds 63 fixtures,
one per catalogued finding, built in a temporary directory at run time and
allowed to be artificial.

Each one declares the exact set of ids the tool reports on it, and
[`test/coverage.mjs`](test/coverage.mjs) asserts that set in both directions. A
fixture that produces an extra finding fails exactly as loudly as one that
produces too few, because an undeclared finding is the one nobody has looked
at. `npm run verify` fails the build if a catalogue entry has no fixture of its
own, or if no fixture produces it.

This is where the defects are. Writing the corpus for this repository produced
six, every one in a branch the pairs never reach, and every one reproduced by a
test in [`test/regressions.mjs`](test/regressions.mjs) before it was fixed. The
worst of them reported a correct line number for a finding in a file with no
comments in it and the wrong line for every other file, because comment lines
were stripped before the directives were read and that renumbers the file. A
responder opening `.htaccess` at the reported line found a comment.

## Verifying

```bash
npm test        # 264 tests
npm run verify  # 861 repository assertions
npm run exits   # the real binary over every example, both sides
npm run check   # all three
```

Those two numbers check themselves. `npm run verify` reads the test tally back
from the structured event stream `node:test` emits rather than from the text a
reporter prints, because the reporters are not a stable interface: the same
suite prints `# pass` on one Node line and a spec reporter `pass` line on
another, so a verifier that parses reporter output reports a different number
depending on which Node runs it. The assertion count includes its own
comparison. Both are matched against this file as whole lines, so a reflowed
paragraph that splits a number across a line break fails the build instead of
passing with the number missing.

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
`src/` exists in the catalogue and every catalogue entry is both reachable and
has a fixture of its own, that every example pair declares a residual set and
corrects something, that the counts printed in this README are the counts the
code produces, that every internal link resolves, that every symptom page says
what it does not cover, that every test file is named in the test script, that
the engines floor is an exact three part version and CI runs a job on exactly
it, that no CI step redirects an `npm run` into a file, and that no file
contains a dash character that should be plain text.

The counts are counts of the 114 tracked files, worked out by reading
`.gitignore` in [`tools/tracked.mjs`](tools/tracked.mjs) rather than by walking
the tree. A walk counts whatever is lying around, and the engine strict job in
CI runs `npm install`, which writes a lock file even for a package with no
dependencies: the count then disagrees with this README on CI and nowhere else.
Where git is available, CI checks that matcher against `git ls-files` and fails
on any difference, because a hand written gitignore matcher that disagrees with
the real one is worse than none.

CI runs the suite on Node 20.0.0 exactly, 22 and 24, and separately runs the
binary over every example pair, installs with `--engine-strict` on the floor,
and compares the tracked file list against git.

## What it does not tell you

This is the section worth reading before trusting anything above it, and there
is a longer version in [docs/limits.md](docs/limits.md).

There are 7 declared limits, held as data in `src/limits.mjs`, printed by
`wp-triage --limits`, and asserted in both directions in
[`test/limits.mjs`](test/limits.mjs): each one has a test that constructs the
case it describes and asserts the tool is silent, and a test that constructs
the opposite case and asserts the tool is not. A limit written only as a
paragraph goes stale the first time somebody improves the code; one with a test
on both sides fails the build when the tool quietly starts reporting the case
the paragraph says it cannot see.

The strongest of them is about core integrity, and it is worth stating in full.
Every core integrity finding compares modification times. The suite constructs
four installs: core files replaced wholesale or untouched, crossed with the
finding reported or not. All four exist. So for each value of the reported
verdict, both an install with modified core and an install with untouched core
occur, which means the verdict is not even weak evidence about whether a core
file was modified, in either direction. The case that should worry a responder
most is the quiet one: core replaced in full, its timestamp flattened to match
the rest of the release, nothing reported at all.

wp-triage reads the filesystem and nothing else. It cannot see the database, so
injected options, scheduled tasks, an extra administrator account and post
content are all outside it, and a large share of real WordPress compromises
live entirely there. It cannot see server configuration, so it does not know
whether Apache really executes PHP in uploads or whether `.htaccess` is read at
all. It has no signature list, so it finds shapes rather than known families
and cannot tell a commercial plugin's obfuscated licence check from an
injection. Timestamp findings are weak evidence, because copying, restoring and
syncing all rewrite them without changing a byte.

Where two findings would describe the same bytes, only one is reported: the one
whose fix is larger. A fatal error line naming an exhausted memory ceiling is
reported as the memory ceiling and not also as a fatal error, because the two
next actions disagree about what to read. The cost is real and is stated rather
than hidden: the narrower finding is missing from a report where it is also
true.

It reports things that are frequently benign, on purpose. A tool used during an
incident that stays quiet to look accurate is worse than useless, which is why
every finding states what it does not prove and why there is no score.

A clean report means these checks found nothing. It is not a statement that the
site is clean, and it is not something to forward to a client as an all clear.

## Licence

MIT. No attribution required.
