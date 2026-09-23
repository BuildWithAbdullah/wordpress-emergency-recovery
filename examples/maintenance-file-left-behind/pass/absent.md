# Deliberately almost empty

The corrected install differs from the failing one by **not containing
a `.maintenance` file at the web root**.

WordPress writes that file when an update starts and deletes it when the update finishes. If it is still there, the update did not finish, and deleting it is the whole fix in most cases.

There is nothing to show here except its absence, and a directory with no
files in it does not survive a git checkout, which is why this note exists.
