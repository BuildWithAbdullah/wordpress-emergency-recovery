# What wp-triage cannot tell you

This is the page that decides whether the rest of the tool is worth trusting.
Every check in this repository reports what it does not prove, and this is the
same idea applied to the tool as a whole.

## Seven of them are assertions rather than prose

The sections below explain the boundary of a filesystem only tool. Seven
specific limits are also held in `src/limits.mjs` as data, printed by
`wp-triage --limits`, and asserted in `test/limits.mjs` in both directions:
each one has a test that constructs the case the limit describes and asserts
the tool is silent, and a test that constructs the opposite case and asserts
the tool is not. `tools/verify.mjs` fails the build if a limit in the table
has no test, or is not named here.

The difference matters. A limit written only as a paragraph goes stale the
first time somebody improves the code and forgets the paragraph. A limit with
a test on both sides fails the build when the tool quietly starts reporting
the case the paragraph says it cannot see, and fails it again when the tool
stops reporting the case it says it can.

| Limit | What it means |
|---|---|
| `LIMIT-TIMESTAMPS` | A core integrity finding is about timestamps and never about bytes. Core replaced wholesale with a matching timestamp is reported as clean; core untouched with a skewed timestamp is reported. All four combinations are constructed, so the verdict is not even weak evidence either way. |
| `LIMIT-LOG-SIZE` | A log over two megabytes is not read, so the error inside the biggest logs is invisible and only the size is reported. |
| `LIMIT-CONSTANT-EXPRESSION` | The value of a define is read, not evaluated. A literal is judged; anything built from a call or an environment variable is reported as neither on nor off. |
| `LIMIT-APPENDED-PAYLOAD` | A file with an image extension is read for its first thirty two bytes. A PNG header is thirty three, so a payload appended after real image data is not seen. |
| `LIMIT-PERMISSION-CAP` | Permission findings stop at twenty five files and twenty five directories, so the report understates the problem exactly when it is widest. |
| `LIMIT-SYMLINKS` | Nothing is read through a symbolic link, so a shell reachable only through one is reported as nothing. This one is a deliberate trade, not a gap to close. |
| `LIMIT-ONE-REASON` | Where two reasons describe the same bytes, only the one with the larger fix is reported. The narrower finding is absent from a report where it is also true. |

## It reads the filesystem and nothing else

No database connection. No network request. No writes to the install. That is
what makes it safe to run on a site nobody has decided anything about yet, and
it is also the boundary of what it can see.

So it cannot see any of this:

- **The database.** Options, users, roles, scheduled tasks, post content,
  injected `siteurl`, an extra administrator, an application password. A very
  large share of real WordPress compromises live entirely in the database and
  leave no filesystem trace at all.
- **Server configuration.** Whether Apache actually executes `.php` in uploads,
  whether `.htaccess` is even read, what the PHP `memory_limit` or
  `display_errors` really are, what an nginx config does. wp-triage reads
  `.htaccess` because it is a file, and reads nothing else.
- **What happened over HTTP.** Whether a file was ever requested, whether the
  debug log was read, whether a redirect loop occurs in practice.
- **Anything outside the directory you point it at.** Including a
  `wp-config.php` placed one level above the web root, which is a supported and
  common arrangement.

## It has no signature database

It finds shapes, not known malware families. `eval` on decoded input is a shape.
So is a PHP file in uploads, and a name that is not on the drop-in list. This
has two consequences and they run in opposite directions.

It finds things a signature list has never seen, because the shape is what
matters rather than the bytes.

It also cannot recognise a known threat by name, cannot tell you what a payload
does, and cannot distinguish a commercial plugin's licence check from an
injection when both are obfuscated. Some of them genuinely are identical.

## False positives are the design, not a defect

A tool used during an incident that stays quiet to look accurate is worse than
useless. wp-triage reports things that are frequently benign: must-use plugins,
drop-ins, hardcoded site URLs, a default table prefix. Every one of those
findings says, in the report, what it does not prove.

The intended use is a responder reading a list of places to look, not a score.
There is deliberately no score.

## Timestamps are weak evidence

Several checks compare modification times. Copying an install, restoring from
backup, syncing over SFTP, extracting an archive and some deploy tools all
rewrite timestamps without changing a byte. A timestamp finding is a reason to
compare the file against a clean copy. It is not a finding about the file's
contents.

`LIMIT-TIMESTAMPS` states this as the strongest form of the claim, and the
suite constructs it: four installs covering core modified or not against the
finding reported or not. All four exist. For each value of the reported
verdict, both an install with modified core and an install with untouched core
occur, so reading `CORE003` as evidence about the bytes is unsound in both
directions. The case that should worry a responder most is the quiet one:
core replaced in full, timestamp flattened to match the rest of the release,
nothing reported.

## Permissions are read as the running user sees them

The modes reported are what the process running wp-triage can see. PHP may run
as a different user, in a different group, under a different umask, or inside a
container with a different view. On Windows the modes are close to meaningless.

## One span of a file, one reason

Where two findings would describe the same bytes, the tool reports one of
them: the one whose fix is larger. A fatal error line naming an exhausted
memory ceiling is reported as the memory ceiling and not also as a fatal
error, because the two next actions disagree about what to read. A must-use
loader whose target both leaves the directory and sits in a writable one is
reported as the writable case only, because the fix there includes closing
the write access and the other does not.

This is `LIMIT-ONE-REASON`, and the cost is stated rather than hidden: the
narrower finding is missing from a report where it is also true. The reason
for paying it is that an incident queue with one item per span of bytes is
workable and one with two items per span, whose advice disagrees, is not.

## Limits that can silently truncate a run

Large installs stop at 60000 files and 12 directory levels, and files over 2 MB
are not read as text. When a limit is reached the report says so, on the
`Files seen` line. Symbolic links are recorded but never followed, because a
link pointing out of the install is how a read-only tool stops being read-only.

## A clean report

A clean report means these checks found nothing. It is not a statement that the
site is uncompromised, not a statement that it will boot, and not something to
forward to a client as an all clear. The report says as much in its own output,
in both formats, for exactly this reason.
