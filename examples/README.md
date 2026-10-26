# Example pairs

Every pair is a failing install and the corrected one beside it. Both sides
are overlaid onto `_baseline`, a small install with nothing wrong with it, so
that each pair contains only the files that actually differ. `test/examples.mjs`
runs wp-triage over both sides and asserts the exact set of findings on each,
and `tools/exit-codes.mjs` runs the real binary over both and checks the exit
code against the one the manifest implies. That is what keeps this directory
honest.

Fixtures shaped like malware exit on their first statement and keep the
flagged text inside a string literal or a comment. Nothing here runs.

| Pair | What it shows | Reported | Residual |
|---|---|---|---|
| [`debug-display-on`](debug-display-on) | WP_DEBUG is on and errors are rendered into the page instead of a log. | CONFIG001 | none |
| [`debug-log-in-web-root`](debug-log-in-web-root) | The debug log path is built with a function call and resolves inside the web root, where a request can read the paths and queries it records. | CONFIG002, LOG002, LOG006 | none |
| [`maintenance-file-left-behind`](maintenance-file-left-behind) | An update stopped part way and left the file that shows every visitor the maintenance notice. | UPD001 | none |
| [`uploads-php-shell`](uploads-php-shell) | A PHP file with a double extension sitting in the media directory. | UP003, OBF001 | none |
| [`uploads-htaccess-php-handler`](uploads-htaccess-php-handler) | The uploads directory is configured to execute PHP. | HTA002 | none |
| [`output-before-open-tag`](output-before-open-tag) | A blank line before the opening PHP tag in the theme, which breaks every redirect and cookie. | OUT001 | none |
| [`obfuscated-mu-loader`](obfuscated-mu-loader) | A must-use plugin that loads before everything and hides what it does. | DROP003, OBF001 | DROP003 |
| [`mu-loader-from-uploads`](mu-loader-from-uploads) | A must-use plugin whose body is loaded from the uploads directory, so anything that can write a file decides what runs on every request. | DROP003, DROP006 | DROP003 |
| [`unknown-dropin`](unknown-dropin) | A file in wp-content named like a drop-in, which WordPress does not actually load. | DROP001 | DROP002 |
| [`htaccess-redirect-loop`](htaccess-redirect-loop) | One rule forces https and another names an http target, which is a redirect loop in the browser. | HTA004 | none |
| [`canonical-host-rules`](canonical-host-rules) | Two canonical host rules, written months apart, that each rewrite away from the host the other one wants. | HTA006 | none |
| [`rogue-root-php`](rogue-root-php) | A PHP file at the web root that no WordPress release ships. | CORE001 | none |

`SHAPE005` is reported on both sides of every pair, because the baseline names
the release it claims to be, and it is left out of the table for readability.
The sets in `manifest.json` include it and are exact.

## The residual column is the point

It is the exact set of findings still reported once the defect is corrected,
and it is asserted in both directions. Everything the failing side reported has
to be gone unless it is listed here, and everything listed here has to still be
there. Two pairs have a residual finding and both are the same one: correcting a
must-use loader does not stop the plugin being must-use, and a reader on an
incident still wants to know that something loads before the admin exists and
cannot be switched off from it.

`unknown-dropin` is the interesting one, because its residual finding is a
different id from the one it corrects. The failing side has a file named like a
drop-in that WordPress loads from nowhere. The corrected side has a real
drop-in, which is reported as a normal part of a tuned install rather than as a
problem. The fix changes which finding you get, not whether you get one.

## Where the rest of the evidence is

The pairs reach a minority of the catalogue, which is why
[`test/corpus.mjs`](../test/corpus.mjs) exists: one fixture per catalogued
finding, built at run time, each declaring the exact set of ids it produces.
A pair has to be a plausible broken install that a reader recognises, and most
of the catalogue is not plausible on its own.

## What a pair can never be

Permissions in particular can never be a pair. The `permissions` check reads
file modes and git carries only the executable bit, so a committed fixture
cannot represent a world writable wp-config.php at all. Those cases are built
in a temporary directory at run time, in `test/checks-permissions.mjs` and in
the corpus.
