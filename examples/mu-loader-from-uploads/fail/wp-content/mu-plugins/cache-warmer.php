<?php
/**
 * FAILING: a must-use plugin whose real body lives in the uploads directory.
 *
 * Two separate problems sit in this one line. The code loads before the
 * plugins screen exists, so it cannot be switched off from the admin. And it
 * is loaded from a directory the site itself writes to, which means anything
 * able to write a file there decides what runs on every request. Deleting the
 * target does not finish the job while the write access is still open.
 */
include_once '../uploads/cache/warm.php';
