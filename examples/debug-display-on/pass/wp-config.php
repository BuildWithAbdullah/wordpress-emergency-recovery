<?php
/**
 * CORRECTED: debugging stays available, but output goes to a log outside the
 * document root rather than into the page. This is the shape you want on a
 * production site you are actively debugging.
 */
define( 'DB_NAME', 'site_db' );
define( 'DB_USER', 'site_user' );
define( 'DB_PASSWORD', 'not-a-real-password' );
define( 'DB_HOST', 'localhost' );

define( 'AUTH_KEY',         'h1Qd+7yTQmS0vX2fLpN8aZ3cRkE6uJwB' );
define( 'SECURE_AUTH_KEY',  'p4Zx*2mKdV9sT7eGqLb0nYcH5rWjA8uF' );
define( 'LOGGED_IN_KEY',    'r8Nv-3jXwQ1tD6yMzC0kPbS9hUeL5gAo' );
define( 'NONCE_KEY',        'k2Bs^9pRfT4uW7xJdN1mQyE3vZcH6aGl' );

define( 'WP_DEBUG', true );
define( 'WP_DEBUG_DISPLAY', false );
define( 'WP_DEBUG_LOG', '/var/log/site/php-debug.log' );
@ini_set( 'display_errors', 0 );
define( 'WP_MEMORY_LIMIT', '256M' );

$table_prefix = 'site_';

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}
require_once ABSPATH . 'wp-settings.php';
