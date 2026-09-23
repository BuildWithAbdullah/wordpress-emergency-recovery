# What wp-triage cannot tell you

This is the page that decides whether the rest of the tool is worth trusting.
Every check in this repository reports what it does not prove, and this is the
same idea applied to the tool as a whole.

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

## Permissions are read as the running user sees them

The modes reported are what the process running wp-triage can see. PHP may run
as a different user, in a different group, under a different umask, or inside a
container with a different view. On Windows the modes are close to meaningless.

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
