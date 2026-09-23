# Allowed memory size exhausted

PHP asked the operating system for memory, hit its own ceiling, and stopped.
The log line names the ceiling and the size of the allocation that broke it,
and those two numbers are the whole diagnosis.

```
PHP Fatal error:  Allowed memory size of 268435456 bytes exhausted
(tried to allocate 20480 bytes) in /var/www/site/wp-includes/post.php on line 601
```

## Read the second number first

```
How big was the allocation that failed?
├── Small, a few kilobytes
│   └── The ceiling was already full. Something accumulated over the request.
│       Raising the limit buys time and does not fix it.
└── Large, megabytes at once
    └── One operation tried to hold something enormous. An unbounded query,
        a full export, an image resize, a log read into a string.
```

A small failing allocation is the common case and the one people misread. It
means memory was already gone, and the file named in the error is simply where
the next request for a few bytes happened to land. That file is almost never
the culprit.

## Where it actually goes

- A query with no limit, holding every row of a large table. `get_posts` with
  `'posts_per_page' => -1` on a site that has grown is the classic.
- Image processing. A 6000 pixel JPEG costs far more in memory than on disk,
  and the multiplier is roughly width times height times four bytes.
- Something reading a file into a string. A debug log that has grown to
  hundreds of megabytes, read by a plugin that wants its last line.
- An infinite or near infinite loop building an array.

## Raising the limit, honestly

Raising it is a legitimate first test, because it tells you which case you are
in. If 512M runs to completion, the work is large but bounded. If it fails
again at 512M, you have a loop, and no ceiling will be high enough.

```php
define( 'WP_MEMORY_LIMIT', '256M' );
define( 'WP_MAX_MEMORY_LIMIT', '512M' );
```

`WP_MEMORY_LIMIT` cannot exceed the PHP `memory_limit` set for the pool. If the
constant appears to do nothing, that is why, and the change belongs in the PHP
configuration instead.

## What wp-triage covers here

`--only logs,config` reads the allocation size out of the log for you and
reports whether a memory constant is set at all.

## What this tree does not cover

Memory pressure at the server level rather than the PHP level: the OOM killer
terminating PHP-FPM workers. That appears in the kernel log, not in the PHP
log, and the PHP log in that case shows nothing at all, which is itself the
clue.
