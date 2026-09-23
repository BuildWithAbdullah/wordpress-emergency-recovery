# Example pairs

Every pair is a failing install and the corrected one beside it. Both sides
are overlaid onto `_baseline`, a small install with nothing wrong with it, so
that each pair contains only the files that actually differ. `test/examples.mjs`
runs wp-triage over both sides and asserts the finding appears on one and not
the other, which is what keeps this directory honest.

Fixtures shaped like malware exit on their first statement and keep the
flagged text inside a string literal or a comment. Nothing here runs.

| Pair | What it shows | Finding |
|---|---|---|
| [`debug-display-on`](debug-display-on) | WP_DEBUG is on and errors are rendered into the page instead of a log. | CONFIG001 |
| [`maintenance-file-left-behind`](maintenance-file-left-behind) | An update stopped part way and left the file that shows every visitor the maintenance notice. | UPD001 |
| [`uploads-php-shell`](uploads-php-shell) | A PHP file with a double extension sitting in the media directory. | UP003 |
| [`uploads-htaccess-php-handler`](uploads-htaccess-php-handler) | The uploads directory is configured to execute PHP. | HTA002 |
| [`output-before-open-tag`](output-before-open-tag) | A blank line before the opening PHP tag in the theme, which breaks every redirect and cookie. | OUT001 |
| [`obfuscated-mu-loader`](obfuscated-mu-loader) | A must-use plugin that loads before everything and hides what it does. | DROP003, OBF001 |
| [`unknown-dropin`](unknown-dropin) | A file in wp-content named like a drop-in, which WordPress does not actually load. | DROP001 |
| [`htaccess-redirect-loop`](htaccess-redirect-loop) | Two rules that each undo the other, which is a redirect loop in the browser. | HTA004 |
| [`rogue-root-php`](rogue-root-php) | A PHP file at the web root that no WordPress release ships. | CORE001 |

## What the pairs do not cover

Permissions. The `permissions` check reads file modes, and git carries only
the executable bit, so a committed fixture cannot represent a world writable
wp-config.php. `test/checks-permissions.mjs` builds those cases in a temporary
directory at runtime instead.
