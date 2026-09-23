# HTTP 500

The server answered, then gave up. Unlike a white screen, a 500 means the web
server itself is unhappy, so there are two logs to read rather than one.

## Read the web server log first

The PHP log tells you about PHP. The web server log tells you about
configuration, and a 500 is very often configuration.

```bash
tail -n 100 /var/log/apache2/error.log
tail -n 100 /var/log/nginx/error.log
```

An invalid directive in `.htaccess` produces a 500 on every request with no PHP
involvement at all, and nothing in the PHP log.

## The decision

```
Does the web server log name .htaccess?
├── Yes -> rename .htaccess and reload
│   ├── Site loads -> the file is the problem, rebuild it from the stock block
│   └── Still 500 -> keep reading
└── No
    ├── Does the PHP log show a fatal error?
    │   └── Yes -> the fatal is the bug, the 500 is the symptom.
    │              Go to white-screen.md, the decision is the same.
    └── No PHP log entry at all
        ├── PHP-FPM pool down or out of workers -> check the FPM log
        ├── PHP version changed under the site -> check the handler
        └── Permissions: PHP cannot read a file it must include
```

## The five causes, in the order they actually occur

1. A directive in `.htaccess` that the server does not understand. Usually
   added by a plugin, a security tool, or a host migration.
2. A PHP fatal error, with the 500 produced by FPM rather than by Apache.
3. A PHP version change. Hosts move sites to a newer PHP without warning and
   an abandoned plugin stops parsing.
4. Permissions. A file mode of 0600 owned by a user PHP does not run as
   produces a 500 with a single unhelpful line in the log.
5. Memory or worker exhaustion under load, which looks intermittent. See
   memory-exhaustion.md.

## What wp-triage covers here

`--only htaccess,logs,permissions` finds directives that change how PHP runs,
a fatal that was already logged, and modes that stop PHP reading its own files.

## What this tree does not cover

A 500 coming from a reverse proxy or CDN rather than from your server. If the
response headers name a proxy and your own access log has no matching entry,
the request never reached you and nothing in this repository applies.
