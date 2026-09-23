# Briefly unavailable for scheduled maintenance

The shortest incident in this directory, and one of the most alarming to a site
owner, because the site is entirely gone as far as a visitor is concerned.

## What is happening

At the start of an update, WordPress writes a file called `.maintenance` at the
web root. While it exists, every front end request gets the maintenance notice
instead of the site. At the end of the update, WordPress deletes it.

If it is still there, the update did not reach the end. A closed browser tab, a
PHP timeout during extraction, or a fatal error part way through all leave it
behind.

## The fix

```bash
ls -la /var/www/site/.maintenance
rm /var/www/site/.maintenance
```

That is usually the entire incident. Do not stop there.

## Then find out what interrupted it

The update stopped for a reason, and the site is now in whatever state it
stopped in.

```
What was being updated?
├── A plugin or theme
│   └── Check wp-content/upgrade for a leftover extraction directory.
│       Reinstall that plugin from a clean archive rather than trusting
│       a half extracted one.
└── WordPress core
    └── Core may be half replaced. Check wp-includes/version.php against
        the version you expected, and replace wp-admin and wp-includes
        wholesale from that release.
```

A half extracted plugin is how you get "Cannot redeclare" on the next request:
two copies of the same code, one in place and one in `upgrade`.

## If it comes back

A site that re-enters maintenance mode on its own is a site whose updates keep
timing out. Look at the PHP execution time limit and at how long the host takes
to fetch an archive. Automatic background updates run unattended, so nobody
sees them fail.

## What wp-triage covers here

`--only updates` reports the file, decodes the timestamp inside it so you know
when the update started, and reports anything left in `wp-content/upgrade`.

## What this tree does not cover

Maintenance pages served by a plugin or by the host rather than by core. Those
have nothing to do with `.maintenance` and are switched off wherever they were
switched on.
