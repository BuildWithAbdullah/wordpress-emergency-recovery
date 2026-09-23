<?php
/**
 * CORRECTED: advanced-cache.php IS on the drop-in list, so WordPress loads it
 * by design. wp-triage still reports it, at medium severity, because an
 * orphaned caching drop-in keeps running long after the plugin that installed
 * it has been deleted.
 *
 * A drop-in is not a problem. A drop-in whose owner is gone is.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
