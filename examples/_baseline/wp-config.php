<?php
/**
 * A configuration file with nothing wrong with it, used as the baseline
 * every example pair is overlaid on.
 */
define( 'DB_NAME', 'site_db' );
define( 'DB_USER', 'site_user' );
define( 'DB_PASSWORD', 'not-a-real-password' );
define( 'DB_HOST', 'localhost' );

define( 'AUTH_KEY',         'h1Qd+7yTQmS0vX2fLpN8aZ3cRkE6uJwB' );
define( 'SECURE_AUTH_KEY',  'p4Zx*2mKdV9sT7eGqLb0nYcH5rWjA8uF' );
define( 'LOGGED_IN_KEY',    'r8Nv-3jXwQ1tD6yMzC0kPbS9hUeL5gAo' );
define( 'NONCE_KEY',        'k2Bs^9pRfT4uW7xJdN1mQyE3vZcH6aGl' );

define( 'WP_DEBUG', false );
define( 'WP_DEBUG_DISPLAY', false );
define( 'WP_MEMORY_LIMIT', '256M' );

$table_prefix = 'site_';

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}
require_once ABSPATH . 'wp-settings.php';
