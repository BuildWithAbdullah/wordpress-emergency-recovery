# Error establishing a database connection

WordPress could not reach the database, or reached it and was refused. The
message is the same either way, which is why this takes longer than it should.

## Separate the two cases first

Connect from the same machine WordPress runs on, with the credentials in
`wp-config.php`.

```bash
mysql -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" -e 'SELECT 1'
```

That one command splits the problem in half.

```
Does the command connect?
├── No
│   ├── "Access denied"        -> credentials or grants
│   ├── "Can't connect"        -> the server is down, or the host is wrong
│   ├── "Unknown database"     -> the database is gone or renamed
│   └── "Too many connections" -> the server is up and saturated
└── Yes, connects fine
    ├── wp-config.php is not the file being read (check for a second install,
    │   or a WP_CONFIG override, or a symlinked root)
    ├── The table prefix does not match the tables that exist
    └── The database is up but the WordPress tables are missing or corrupt
```

## Access denied

Credentials changed, or the grant did. A password rotated by a host, or a grant
issued for `user@localhost` when the site now connects from `127.0.0.1`, are
different hosts to MySQL even though they are the same machine.

## Cannot connect

Check `DB_HOST` against what the host actually provides. On managed hosting it
is often not `localhost` but a named server. If the site was migrated, that
value is the first thing that goes stale.

## Too many connections

The database is fine. Something is opening connections and not closing them, or
the site is under more load than the server is provisioned for. Restarting the
database clears it and it comes back, which is how you know it is not the fix.
Look at slow queries and at cron.

## Corrupt tables

If the connection works but WordPress still fails, check the tables before
repairing anything. A repair is a write, and writes are what you were trying to
avoid.

```bash
mysqlcheck --check site_db
```

Only then, with a dump taken first, repair.

## What wp-triage covers here

Very little, and that is the honest answer. wp-triage never opens a database
connection, so it cannot tell you whether the database is reachable. What it
can tell you is whether `wp-config.php` still holds sample credentials, whether
the table prefix is what you think it is, and whether the file has been edited:
`--only config`.

## What this tree does not cover

An intermittent connection error under load, which is usually connection
limits or a noisy neighbour on shared hosting, and is a capacity question
rather than a configuration one.
