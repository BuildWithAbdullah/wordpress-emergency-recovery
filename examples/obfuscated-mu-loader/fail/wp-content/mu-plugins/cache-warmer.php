<?php
exit; // Inert fixture. This file stops here and never executes anything below.

/*
 * FAILING: a file in mu-plugins loads on every request, cannot be deactivated
 * from the admin, and does not appear on the plugins screen. That is what
 * makes the directory attractive, and it is the first place to look when a
 * site keeps reinfecting after the plugins have been replaced.
 *
 * Everything below is held in string literals and never evaluated.
 */
$shape = 'eval(base64_decode("ZWNobyAxOw=="));';
