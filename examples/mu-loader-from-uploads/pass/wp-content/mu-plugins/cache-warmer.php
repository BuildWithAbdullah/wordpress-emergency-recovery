<?php
/**
 * CORRECTED: the body is here, in a directory the site does not write to.
 *
 * The must-use finding does not go away, and it should not. This file still
 * loads before everything and still cannot be deactivated from the admin,
 * which is worth knowing on an incident whatever else is true. What has gone
 * is the part a responder can do nothing about: code arriving from a location
 * any upload can overwrite.
 */
add_action( 'init', function () {
	if ( ! wp_next_scheduled( 'sample_warm_cache' ) ) {
		wp_schedule_event( time(), 'hourly', 'sample_warm_cache' );
	}
} );
