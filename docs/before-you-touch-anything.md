# Before you touch anything

The first ten minutes of an incident decide whether the rest of it is
recoverable. Almost every unrecoverable WordPress incident I have seen became
unrecoverable because somebody tried a fix before taking a copy.

## 1. Take a copy of the broken state

Not a backup of the working site. A copy of the broken one, files and database
both, before any change.

```bash
tar czf /tmp/site-$(date +%Y%m%d-%H%M).tar.gz -C /var/www/site .
mysqldump --single-transaction site_db > /tmp/site-db-$(date +%Y%m%d-%H%M).sql
```

Two reasons, and the second is the one people forget.

The broken state is the evidence. Modification times, file ownership and the
contents of anything injected are the only record of how this happened. A
restore from last night's backup destroys all of it and leaves you with a
working site and no idea why it broke, which means it breaks again.

The broken state is also the thing you fall back to. A fix that makes things
worse is normal. A fix that makes things worse with no way back is an outage
that lasts days.

## 2. Write down the time

The time the site broke, the time you were told, and the time you started.
Every log you are about to read is timestamped, and you will be comparing them
against each other. Use `docs/recovery-log-template.md`.

## 3. Read before you write

Run `wp-triage` first. It reads the install and reports what it finds. It never
writes to the install, never opens a database connection and never makes a
network request, which is why it is safe to run on a site you have not yet
decided anything about.

```bash
npx wp-triage /var/www/site --format markdown > /tmp/triage.md
```

## 4. Change one thing at a time

The temptation under pressure is to disable all plugins, switch the theme,
raise the memory limit and clear the cache in one pass. It usually works, and
you will have no idea which one it was, so you cannot stop it recurring and you
cannot tell the client what happened.

One change, one test, one line in the log.

## 5. Know what would make you stop

Decide this now, while you are calm, not in twenty minutes when you are not:

- Evidence of an active intrusion rather than a broken update. Stop and
  preserve. Bringing the site back up before you know how they got in means
  doing this again on Friday.
- Customer data that may have been reached. That is a disclosure question with
  a legal clock on it, and it is not yours to decide alone.
- The realisation that you do not have a working backup. Stop changing things.
  The broken site is now the only copy that exists.

## 6. Say something to the site owner

Short, plain, and before they ask. What is broken, what you are doing, when you
will next update them. Silence during an outage costs more trust than the
outage does.
