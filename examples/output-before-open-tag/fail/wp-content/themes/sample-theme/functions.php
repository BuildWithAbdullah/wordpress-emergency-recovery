
<?php
/**
 * FAILING: there is a newline before the opening tag on line 1. That newline
 * is response body. It is sent the moment this file loads, which is before
 * WordPress has had a chance to send a single header.
 *
 * The visible symptom is never "there is a blank line in functions.php". It is
 * "I cannot log in", or "the redirect after saving does nothing", or a
 * warning about headers already sent naming a completely different file.
 */
add_action( 'wp_enqueue_scripts', function () {} );
