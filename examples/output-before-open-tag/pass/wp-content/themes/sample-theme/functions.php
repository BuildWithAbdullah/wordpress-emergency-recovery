<?php
/**
 * CORRECTED: the opening tag is the first byte of the file, and there is no
 * closing tag at the end, so nothing can be appended after it by accident.
 */
add_action( 'wp_enqueue_scripts', function () {} );
