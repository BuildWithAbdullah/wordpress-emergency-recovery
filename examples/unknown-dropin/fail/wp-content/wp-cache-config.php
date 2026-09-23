<?php
exit; // Inert fixture. This file stops here and never executes anything below.

/*
 * FAILING: WordPress loads a fixed list of filenames from wp-content and
 * ignores everything else. wp-cache-config.php is not on that list, so
 * WordPress never loads it. Something else must, and finding what includes it
 * is the actual question.
 *
 * A name that reads like infrastructure is the point. Nobody deletes a file
 * called wp-cache-config.php on a hunch.
 */
$note = 'this file is not loaded by WordPress';
