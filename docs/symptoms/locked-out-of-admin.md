# Locked out of the admin

The front end works. You cannot get in. The failure mode matters more than the
symptom, so establish which one you have before doing anything.

```
What exactly happens at /wp-login.php?
├── "Unknown username" or "incorrect password"
│   └── Credentials. The account may also have been changed by someone else.
├── Login appears to succeed, then returns to the login form
│   └── Cookies. The session is not surviving the redirect.
├── Login succeeds, then "You do not have sufficient permissions"
│   └── The role or capabilities on the account, not the password.
├── The login page itself is blank or errors
│   └── Not a login problem. Go to white-screen.md.
└── The page never loads, or loops
    └── Go to redirect-loop.md.
```

## Credentials

Reset from the database rather than by email, which needs working mail.

```sql
UPDATE site_users SET user_pass = MD5('a-temporary-password') WHERE user_login = 'admin';
```

WordPress accepts an MD5 hash on login once and immediately rehashes it
properly. Change it again from the admin as soon as you are in, because the
plaintext is now in your shell history and in the database log.

If you have WP-CLI, it is cleaner:

```bash
wp user update admin --user_pass='a-temporary-password'
```

## The login loops back to the form

The cookie is being set for a domain the browser is not on, or is being
rejected. Check `WP_HOME` and `WP_SITEURL` against the URL in the address bar,
including www and scheme. Check for a `COOKIE_DOMAIN` constant left over from
a migration.

Salts that changed log everybody out, once. If it happens on every attempt, it
is not the salts.

## Sufficient permissions

The account exists and the password works, so the role was changed. Check
`wp_capabilities` in the user meta table, and check the table prefix while you
are there: a user meta key with the wrong prefix leaves an account with no
role at all, which is exactly this symptom and is a classic migration artefact.

## When it is not an accident

If an administrator account you do not recognise exists, or yours was demoted,
stop treating this as a lockout. Go to hacked-site.md and preserve the state
before changing passwords, because the account list and its timestamps are
evidence.

## What wp-triage covers here

`--only config,output` reports hardcoded site URL constants and stray output
before the headers, which is the cause of a login that silently fails to set
its cookie. The rest of this page is database work that wp-triage does not do.

## What this tree does not cover

Two factor plugins and SSO integrations, which fail in their own ways and
usually have their own recovery constant to disable them from `wp-config.php`.
