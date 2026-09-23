<?php
/**
 * CORRECTED: a must-use plugin is not a finding in itself, and this one still
 * shows up in the report at medium severity so that whoever is reading knows
 * it loads before everything else. What is gone is the hidden payload: the
 * file now says plainly what it does.
 */
add_action( 'shutdown', function () {
	// Warm the object cache for the front page on a low priority schedule.
} );
