# Deliberately almost empty

The corrected install differs from the failing one by **not containing
any PHP file under `wp-content/uploads`**.

The corrected install carries media only. Preserve a copy of anything you remove, with its modification time, before deleting it: that timestamp is what you match against the access log to find how it arrived.

There is nothing to show here except its absence, and a directory with no
files in it does not survive a git checkout, which is why this note exists.
