<?php
exit; // Inert fixture. This file stops here and never executes anything below.

/*
 * FAILING: the WordPress root holds a short, fixed set of PHP files, and this
 * is not one of them. A name one character away from a real core file is a
 * deliberate choice: it survives a skim of the directory listing.
 *
 * The check that catches this compares the root against the release file list
 * rather than against a list of bad names, which is why it catches names
 * nobody has seen before.
 */
$note = 'not shipped by any WordPress release';
