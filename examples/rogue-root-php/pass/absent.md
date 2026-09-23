# Deliberately almost empty

The corrected install differs from the failing one by **not containing
any PHP file at the web root beyond the fifteen core ones**.

The corrected install has exactly the root files the release ships. Compare your own root against the file list for the version in wp-includes/version.php, not against your memory of it.

There is nothing to show here except its absence, and a directory with no
files in it does not survive a git checkout, which is why this note exists.
