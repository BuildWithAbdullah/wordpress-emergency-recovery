# White screen, no error text

A blank page with a 200 response. Nothing rendered, nothing logged where you
can see it. This is PHP dying with error display switched off, which is the
correct production setting and also the reason you are guessing.

## Get the error text first

Stop diagnosing until you can see the error. Everything below is faster once
you can.

1. Set `WP_DEBUG` true and `WP_DEBUG_LOG` to an absolute path **outside** the
   web root, with `WP_DEBUG_DISPLAY` false. Never display errors on a site the
   public can reach: they carry absolute paths, and database errors carry the
   database name.
2. Reload the page once.
3. Read the log.

```php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_DISPLAY', false );
define( 'WP_DEBUG_LOG', '/var/log/site/php-debug.log' );
@ini_set( 'display_errors', 0 );
```

If nothing is written to that log, PHP died before WordPress loaded, or died
so hard it could not write. Look at the web server error log instead. A
segfault or an out of memory kill appears there and nowhere else.

## The decision

```
Is the admin also white?
├── No, only the front end white
│   └── Theme. Rename the active theme directory and reload.
│       Reverts to a default theme and tells you in one step.
└── Yes, both white
    ├── Does the error name a file?
    │   ├── In wp-content/plugins/x  -> rename that plugin directory
    │   ├── In wp-content/themes/x   -> rename that theme directory
    │   ├── In wp-includes or wp-admin -> core is damaged, see below
    │   └── In wp-config.php         -> read the file, top to bottom
    └── No error at all
        ├── Check for a .maintenance file at the root, and remove it
        ├── Check the PHP version against what the theme requires
        └── Rename wp-content/plugins to plugins-off and reload
```

Renaming rather than deleting is the whole trick. It deactivates everything
without touching the database, and renaming it back restores the exact state
you started from. Deleting a plugin directory loses its settings.

## What wp-triage covers here

`--only shape,logs,config,output` covers most of it: whether the install is
intact, what the error log already says, whether errors are being swallowed,
and whether something is writing output before the headers.

## If core is damaged

Do not patch individual files. Download the release named in
`wp-includes/version.php`, and replace `wp-admin` and `wp-includes` wholesale.
Leave `wp-content` and `wp-config.php` alone. Half replaced core is a class of
bug that takes days to find.

## What this tree does not cover

A white screen that is actually a caching layer serving an empty response it
cached during the outage. If the site works for you logged in and not logged
out, you are looking at the cache, not at PHP. Purge it before going further.
