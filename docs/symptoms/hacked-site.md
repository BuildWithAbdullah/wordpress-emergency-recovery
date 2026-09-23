# Suspected compromise

The one page here where the first instinct is the wrong one. Cleaning up feels
like progress and destroys the only record of how they got in, which means it
happens again.

## Preserve before anything

1. Copy the whole install and a database dump, as described in
   `../before-you-touch-anything.md`.
2. Copy the access and error logs. These rotate, often daily, and they are the
   only thing that tells you when and through what.
3. Write down the time you started. From here on, modification times on the
   install are partly yours.

## Establish what you actually have

Not every odd file is a compromise, and not every compromise is where it looks.

```
What made you suspect it?
├── The host or a scanner reported it
│   └── Get the specific file and signature from them. A scanner report with
│       no path is a starting point, not a finding.
├── Visitors see spam content or get redirected
│   ├── Only from search results or only on mobile
│   │   └── Conditional injection. Check the user agent and referrer handling.
│   │       You will not reproduce it by loading the page directly.
│   └── Always
│       └── Injected into the theme, a drop-in, or the database options.
├── An unfamiliar administrator account exists
│   └── Read the user table timestamps before changing anything.
└── Files changed that nobody changed
    └── Compare against the clean release and against your own deploy record.
```

## Where persistence lives

In rough order of how often it is the answer:

1. `wp-content/mu-plugins`. Loads on every request, cannot be deactivated from
   the admin, and does not appear on the plugins screen.
2. Drop-ins in `wp-content`: `object-cache.php`, `advanced-cache.php`, `db.php`.
   Loaded by core, owned by nobody once the plugin is gone.
3. `auto_prepend_file` in `.htaccess` or the PHP configuration. Runs before
   every request with no reference anywhere in the WordPress code.
4. Uploads. Nothing in WordPress writes PHP into `wp-content/uploads`.
5. A scheduled task in the database calling back out.
6. An extra administrator account, or an existing account with an added
   application password.

A clean up that replaces core and plugins but misses all six of these is a
clean up that lasts until the next request.

## Replacing rather than cleaning

Do not edit injected code out of files. Replace:

- Core: the full release matching `wp-includes/version.php`.
- Plugins and themes: fresh copies from source, not from the site.
- Anything custom: from version control, not from the server.

What is left after that is the part you actually have to read: `wp-config.php`,
`wp-content/uploads`, drop-ins, mu-plugins, and the database.

## Then close the way in

Rotate in this order, because each one invalidates things the last did not:

1. Database password, and the salts in `wp-config.php`. This ends every
   existing session.
2. All administrator passwords, and every application password.
3. Hosting, SFTP and SSH credentials, and any deploy key.
4. Any API key the site held, which includes payment and mail keys.

Until the entry point is known, you are rotating credentials on a site that may
still be reachable by the same route.

## What wp-triage covers here

Most of what it does, so run it whole rather than with `--only`. It reports
executables in uploads, unknown drop-ins, must-use plugins, obfuscation
signatures, `auto_prepend_file`, unexpected files at the root and in core
directories, and core timestamps out of step with the rest of the release.

## What it does not cover, and this matters here

wp-triage does not read the database, so scheduled tasks, injected options,
user accounts and post content are all outside it. It does not detect
compromises with no filesystem signature. It has no signature list, so it finds
shapes rather than known families. A clean wp-triage report is not a statement
that the site is clean. It is a statement that these specific filesystem
checks found nothing, which is a much smaller claim.

## When to stop and escalate

If customer data may have been reached, that is a disclosure question with a
legal clock on it, and it is not a decision to make alone at midnight. Preserve
everything, tell the owner in writing, and get the question in front of whoever
is responsible for it.
