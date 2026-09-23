# Too many redirects

The browser followed a chain of redirects until it gave up. Something is
sending a request back where it came from, and there are only four places it
can be coming from.

## The four sources, in order

1. The database. `siteurl` and `home` in the options table.
2. `wp-config.php`. `WP_HOME` and `WP_SITEURL` override the database silently.
3. `.htaccess` or the nginx config. Rewrite rules forcing a scheme or a host.
4. A proxy or CDN in front of the site, terminating TLS and telling PHP the
   request arrived over http.

## See the chain before you guess

```bash
curl -sSIL https://example.test | grep -iE '^(HTTP|location)'
```

The output is the loop, written down. Read which host and scheme each hop goes
to, and the pattern is usually obvious in one look.

```
Where does the chain bounce between?
├── http and https on the same host
│   ├── Rewrite rule forces https, and something forces http back
│   └── Proxy terminates TLS, PHP sees http, WordPress redirects to https,
│       forever. Fix with a trusted proxy header, not with a rewrite rule.
├── www and non-www
│   └── A canonical rule and the database disagree about which is canonical
├── /wp-admin and /wp-login.php
│   └── Almost always cookies: a mismatched domain, or salts that changed
└── Two different domains
    └── A migration left the old domain in the database
```

## The proxy case, because it is the one that wastes an afternoon

Behind a load balancer or a CDN, PHP sees `$_SERVER['HTTPS']` unset, decides
the request is insecure, and redirects to https. The proxy receives the https
request, forwards it as http, and WordPress redirects again.

The fix goes in `wp-config.php`, above the `require` of `wp-settings.php`, and
only when you know the proxy sets that header and strips any client supplied
copy of it:

```php
if ( isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) && 'https' === $_SERVER['HTTP_X_FORWARDED_PROTO'] ) {
	$_SERVER['HTTPS'] = 'on';
}
```

Trusting that header when the proxy does not strip it lets a client assert its
own scheme. That is a real consideration, not a theoretical one.

## The admin only loop

If the front end is fine and `/wp-admin` loops, it is cookies. Check that
`WP_HOME` and `WP_SITEURL` agree with the domain you are actually on, and that
no `COOKIE_DOMAIN` is set to a domain you are not using. Salt changes log
everybody out but do not loop.

## What wp-triage covers here

`--only htaccess,config` reports rules that force a scheme and a host in ways
that can undo each other, and hardcoded `WP_HOME` or `WP_SITEURL` constants
that override the database without appearing in the admin.

## What this tree does not cover

The database side. wp-triage does not read `siteurl` and `home`, so if the
filesystem looks clean, that is the next place to look and it is not in this
tool.
