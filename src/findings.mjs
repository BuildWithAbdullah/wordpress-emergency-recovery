// The finding catalogue.
//
// Every entry states three things and the report prints all three:
//   nextAction   what a responder does with this finding
//   doesNotProve what the finding is NOT evidence of, so nobody escalates on it alone
//
// A check module never invents a finding id. If it is not in this table,
// tools/verify.mjs fails the build.

export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];

export const CATALOGUE = {
  // ---- install shape -------------------------------------------------
  SHAPE001: {
    check: 'shape',
    severity: 'critical',
    title: 'wp-config.php not found',
    nextAction: 'Confirm you pointed wp-triage at the WordPress root. If the path is right, the site has no configuration file and cannot boot.',
    doesNotProve: 'It does not prove the file was deleted. Some hosts keep wp-config.php one level above the web root, where the web server can read it but wp-triage was not told to look.'
  },
  SHAPE002: {
    check: 'shape',
    severity: 'critical',
    title: 'wp-includes/version.php missing',
    nextAction: 'Treat the core install as incomplete. Compare against a clean copy of the same WordPress version before doing anything else.',
    doesNotProve: 'It does not prove an attacker removed it. An interrupted core update deletes files in the same way.'
  },
  SHAPE003: {
    check: 'shape',
    severity: 'high',
    title: 'wp-content directory not found at the default path',
    nextAction: 'Read wp-config.php for a WP_CONTENT_DIR constant and re-run against the real content directory.',
    doesNotProve: 'It does not prove content is missing. A relocated wp-content is a supported configuration.'
  },
  SHAPE004: {
    check: 'shape',
    severity: 'high',
    title: 'Root index.php does not load wp-blog-header.php',
    nextAction: 'Compare index.php with the stock file. A modified front controller is the first place an injected loader goes.',
    doesNotProve: 'It does not prove a compromise. Some subdirectory installs legitimately rewrite this file.'
  },
  SHAPE005: {
    check: 'shape',
    severity: 'info',
    title: 'WordPress version detected',
    nextAction: 'Note the version. Every later comparison against a clean copy has to use this exact release.',
    doesNotProve: 'It does not prove the whole install is on that version. version.php is one file and can be stale or edited.'
  },

  // ---- wp-config -----------------------------------------------------
  CONFIG001: {
    check: 'config',
    severity: 'high',
    title: 'WP_DEBUG is on and errors are displayed to visitors',
    nextAction: 'Set WP_DEBUG_DISPLAY to false and route errors to a log outside the web root. Displayed errors leak paths and often the database name.',
    doesNotProve: 'It does not prove the site is currently leaking. Display also depends on the PHP display_errors setting, which wp-triage cannot read from the filesystem.'
  },
  CONFIG002: {
    check: 'config',
    severity: 'medium',
    title: 'Debug log is written inside the web root',
    nextAction: 'Move the log with WP_DEBUG_LOG set to an absolute path outside the document root, or deny it in the server config.',
    doesNotProve: 'It does not prove the log is reachable over HTTP. The server may already deny it, which is a server config wp-triage does not read.'
  },
  CONFIG003: {
    check: 'config',
    severity: 'critical',
    title: 'wp-config.php still holds sample placeholder credentials',
    nextAction: 'The install cannot connect to a database with these values. Restore the real configuration from backup.',
    doesNotProve: 'It does not prove the database is gone. Only that this file cannot reach it.'
  },
  CONFIG004: {
    check: 'config',
    severity: 'high',
    title: 'Authentication salts are still the sample placeholders',
    nextAction: 'Generate fresh salts. Until you do, session cookies are signed with a value every WordPress copy on earth knows.',
    doesNotProve: 'It does not prove sessions have been forged, only that forging them needs no secret.'
  },
  CONFIG005: {
    check: 'config',
    severity: 'medium',
    title: 'WP_HOME or WP_SITEURL is hardcoded',
    nextAction: 'If the site redirects to the wrong host, this constant is the first thing to check. It overrides the database values silently.',
    doesNotProve: 'It does not prove the value is wrong. Hardcoding is a normal way to pin a site after a migration.'
  },
  CONFIG006: {
    check: 'config',
    severity: 'info',
    title: 'File modification constants are set',
    nextAction: 'Note the value. DISALLOW_FILE_MODS explains why plugin updates fail silently in the admin.',
    doesNotProve: 'It does not prove file writes are blocked. Filesystem permissions decide that, and this constant only stops WordPress from trying.'
  },
  CONFIG007: {
    check: 'config',
    severity: 'critical',
    title: 'Bytes before the opening PHP tag in wp-config.php',
    nextAction: 'Strip everything before the first opening tag, byte order mark included. Output from this file reaches the browser before any header can be sent.',
    doesNotProve: 'It does not prove this is the only source of early output. Other files load before headers are sent too.'
  },
  CONFIG008: {
    check: 'config',
    severity: 'low',
    title: 'No WP_MEMORY_LIMIT set',
    nextAction: 'If the error log shows memory exhaustion, raising this constant is the cheapest first test. It does not override a lower PHP limit.',
    doesNotProve: 'It does not prove memory is the problem. A memory ceiling is only a symptom of whatever is allocating.'
  },
  CONFIG009: {
    check: 'config',
    severity: 'info',
    title: 'Default table prefix in use',
    nextAction: 'Note it and move on. Changing the prefix on a live incident adds risk and fixes nothing.',
    doesNotProve: 'It does not prove the site is less secure. The prefix is obscurity, not a control.'
  },

  // ---- error logs ----------------------------------------------------
  LOG001: {
    check: 'logs',
    severity: 'critical',
    title: 'PHP fatal error in the log',
    nextAction: 'Open the file and line named in the evidence. A fatal error names the exact statement that stopped the request.',
    doesNotProve: 'It does not prove the named file is at fault. The file that fails is often the one that loaded broken code, not the one that broke.'
  },
  LOG002: {
    check: 'logs',
    severity: 'high',
    title: 'PHP memory exhausted',
    nextAction: 'Read the allocation size in the evidence. A request asking for tens of megabytes in one allocation is a loop, not a low ceiling.',
    doesNotProve: 'It does not prove the memory limit is too low. Raising the ceiling on a runaway loop only moves the failure later.'
  },
  LOG003: {
    check: 'logs',
    severity: 'high',
    title: 'Maximum execution time exceeded',
    nextAction: 'Find what the request was doing. Long running work in a web request usually belongs in WP-Cron or a queue.',
    doesNotProve: 'It does not prove the code is slow. A blocked outbound HTTP call looks identical from the log.'
  },
  LOG004: {
    check: 'logs',
    severity: 'high',
    title: 'Cannot redeclare a function or class',
    nextAction: 'Two copies of the same code are loading. Look for a plugin installed twice, or a leftover directory from an interrupted update.',
    doesNotProve: 'It does not prove the duplicate is malicious. Interrupted updates leave duplicate trees behind routinely.'
  },
  LOG005: {
    check: 'logs',
    severity: 'high',
    title: 'Headers already sent',
    nextAction: 'The log names the file and line where output started. That location, not the redirect that failed, is the bug.',
    doesNotProve: 'It does not prove the named file is wrong on disk. Output can also start from a print statement left behind while debugging.'
  },
  LOG006: {
    check: 'logs',
    severity: 'medium',
    title: 'Debug log found inside the web root',
    nextAction: 'Check whether the server serves it. A readable debug.log hands over absolute paths and often query fragments.',
    doesNotProve: 'It does not prove it was read. It proves only that it exists where a request could reach it.'
  },
  LOG007: {
    check: 'logs',
    severity: 'low',
    title: 'Error log is very large',
    nextAction: 'Read the tail first, then the head. A log this size usually means one error repeating, not many different ones.',
    doesNotProve: 'It does not prove the errors are recent. Log size says nothing about when the writing stopped.'
  },

  // ---- interrupted updates -------------------------------------------
  UPD001: {
    check: 'updates',
    severity: 'critical',
    title: 'A .maintenance file is present',
    nextAction: 'This single file is why every visitor sees the maintenance notice. WordPress removes it when an update finishes, so its presence means one did not.',
    doesNotProve: 'It does not prove the update failed badly. A tab closed mid update leaves the same file behind.'
  },
  UPD002: {
    check: 'updates',
    severity: 'high',
    title: 'wp-content/upgrade is not empty',
    nextAction: 'Read the directory names before removing anything. They tell you which plugin or core update stopped part way.',
    doesNotProve: 'It does not prove the extracted files are in use. The upgrade directory is scratch space, not a load path.'
  },
  UPD003: {
    check: 'updates',
    severity: 'high',
    title: 'Core files appear to be from more than one release',
    nextAction: 'Do not patch individual files. Replace wp-admin and wp-includes wholesale from the clean release that matches version.php.',
    doesNotProve: 'It does not prove a version mismatch. Timestamps also skew when files are restored from a partial backup.'
  },
  UPD004: {
    check: 'updates',
    severity: 'medium',
    title: 'Plugin or theme directory looks partially extracted',
    nextAction: 'A plugin directory with no PHP entry point cannot load. Reinstall that plugin from a clean archive.',
    doesNotProve: 'It does not prove the extraction failed. Some directories legitimately hold assets only.'
  },

  // ---- drop-ins and must-use -----------------------------------------
  DROP001: {
    check: 'dropins',
    severity: 'critical',
    title: 'Unknown drop-in in wp-content',
    nextAction: 'WordPress loads a fixed list of drop-in filenames and ignores the rest. A file here that is not on that list, yet is named like one, is worth reading line by line.',
    doesNotProve: 'It does not prove the file executes. A name off the drop-in list is loaded by nothing unless something else includes it.'
  },
  DROP002: {
    check: 'dropins',
    severity: 'medium',
    title: 'Drop-in present',
    nextAction: 'Confirm the plugin that owns this drop-in is still installed and active. An orphaned drop-in keeps loading after its plugin is gone.',
    doesNotProve: 'It does not prove anything is wrong. Caching and database drop-ins are a normal part of a tuned install.'
  },
  DROP003: {
    check: 'dropins',
    severity: 'medium',
    title: 'Must-use plugin present',
    nextAction: 'Read it. Must-use plugins load before everything, cannot be deactivated from the admin, and are not listed on the plugins screen.',
    doesNotProve: 'It does not prove a compromise. Hosts and hardening setups place legitimate code here on purpose.'
  },
  DROP004: {
    check: 'dropins',
    severity: 'high',
    title: 'Must-use loader includes a file from outside mu-plugins',
    nextAction: 'Follow the include. A one line loader that reaches elsewhere on disk is how code stays active after its directory is cleaned.',
    doesNotProve: 'It does not prove the target is hostile. Some frameworks use exactly this pattern to stage their own bootstrap.'
  },
  DROP005: {
    check: 'dropins',
    severity: 'high',
    title: 'Database drop-in present with no matching plugin installed',
    nextAction: 'db.php sits in front of every query the site makes. With no plugin owning it, read it before the site is brought back up.',
    doesNotProve: 'It does not prove it was planted. The owning plugin may simply have been deleted without cleaning up.'
  },

  // ---- .htaccess ------------------------------------------------------
  HTA001: {
    check: 'htaccess',
    severity: 'medium',
    title: 'No .htaccess at the web root',
    nextAction: 'If permalinks return 404 on every page but the home page, this is why. Re-save the permalink settings once the site boots.',
    doesNotProve: 'It does not prove rewriting is broken. Nginx and some managed hosts never read .htaccess at all.'
  },
  HTA002: {
    check: 'htaccess',
    severity: 'critical',
    title: 'PHP execution enabled inside uploads',
    nextAction: 'Remove the handler. An uploads directory that runs PHP turns any file upload hole into code execution.',
    doesNotProve: 'It does not prove anything ran. It proves the path from upload to execution is open.'
  },
  HTA003: {
    check: 'htaccess',
    severity: 'critical',
    title: 'auto_prepend_file directive in .htaccess',
    nextAction: 'Read the prepended file. This directive runs it before every single PHP request on the site, with no reference anywhere in the WordPress code.',
    doesNotProve: 'It does not prove the prepended file is hostile. Some security and monitoring products install themselves this way.'
  },
  HTA004: {
    check: 'htaccess',
    severity: 'high',
    title: 'Rewrite rules that can redirect to themselves',
    nextAction: 'Compare against the site URL in wp-config.php and the database. A loop is usually one rule forcing a host and another forcing it back.',
    doesNotProve: 'It does not prove a loop happens. Conditions wp-triage cannot evaluate may stop it before it repeats.'
  },
  HTA005: {
    check: 'htaccess',
    severity: 'medium',
    title: 'More than one WordPress rule block',
    nextAction: 'Keep the first block and remove the duplicates. WordPress appends a new block when it cannot find its own markers.',
    doesNotProve: 'It does not prove the extra block is unused. Apache reads all of them in order.'
  },

  // ---- output before or after PHP tags --------------------------------
  OUT001: {
    check: 'output',
    severity: 'high',
    title: 'Bytes before the opening PHP tag',
    nextAction: 'Remove them. Anything before the tag is sent to the browser the moment the file loads, which breaks every later header and cookie.',
    doesNotProve: 'It does not prove this file caused the error you are chasing. Any file loaded earlier can do the same.'
  },
  OUT002: {
    check: 'output',
    severity: 'medium',
    title: 'Bytes after the closing PHP tag',
    nextAction: 'Delete the trailing closing tag along with the whitespace. Files that are pure PHP do not need one.',
    doesNotProve: 'It does not prove output reaches the browser. A trailing newline is harmless until the file is included before a header call.'
  },
  OUT003: {
    check: 'output',
    severity: 'high',
    title: 'UTF-8 byte order mark in a PHP file',
    nextAction: 'Re-save the file as UTF-8 without a byte order mark. The three invisible bytes are output, and no editor shows them.',
    doesNotProve: 'It does not prove the mark was added maliciously. Editors on Windows have added it by default for years.'
  },

  // ---- executables in uploads -----------------------------------------
  UP001: {
    check: 'uploads',
    severity: 'critical',
    title: 'PHP file inside uploads',
    nextAction: 'Preserve a copy, note the modification time, then compare it with the access log for that path. Nothing in WordPress writes PHP into uploads.',
    doesNotProve: 'It does not prove the file ran. It proves it is there, and that it did not get there through the media library.'
  },
  UP002: {
    check: 'uploads',
    severity: 'critical',
    title: 'Alternate PHP extension inside uploads',
    nextAction: 'Treat exactly as a .php file. Handlers for phtml, php5, phar and pht are commonly still mapped when .php has been blocked.',
    doesNotProve: 'It does not prove the server executes that extension. Whether it does is server configuration wp-triage cannot read.'
  },
  UP003: {
    check: 'uploads',
    severity: 'critical',
    title: 'Double extension inside uploads',
    nextAction: 'A name ending in .jpg.php is a bypass for filters that only read the first extension. Preserve and remove.',
    doesNotProve: 'It does not prove the upload filter was bypassed. The file may have been placed by a different route entirely.'
  },
  UP004: {
    check: 'uploads',
    severity: 'critical',
    title: 'File with an image extension starts with a PHP open tag',
    nextAction: 'Content and extension disagree. Preserve the file, then look for an include that loads it by path rather than by type.',
    doesNotProve: 'It does not prove it executes as PHP. Without a handler or an include, a mislabelled file is inert.'
  },

  // ---- obfuscation -----------------------------------------------------
  OBF001: {
    check: 'obfuscation',
    severity: 'critical',
    title: 'eval on decoded input',
    nextAction: 'Decode the payload in a text editor, never in a PHP interpreter, and read what it does before deciding anything.',
    doesNotProve: 'It does not prove the site is compromised. A small number of commercial plugins ship licence checks that look exactly like this.'
  },
  OBF002: {
    check: 'obfuscation',
    severity: 'critical',
    title: 'eval on compressed or rotated input',
    nextAction: 'Same as any decoded eval. Unwrap the layers in an editor, read the result, and keep the original for evidence.',
    doesNotProve: 'It does not prove intent. Compression is also used by legitimate obfuscators sold to plugin authors.'
  },
  OBF003: {
    check: 'obfuscation',
    severity: 'critical',
    title: 'preg_replace with the e modifier',
    nextAction: 'This executes the replacement as code. It was removed in PHP 7, so a file using it either predates 2015 or expects an old interpreter.',
    doesNotProve: 'It does not prove the code runs today. On PHP 7 and later the call fails rather than executing.'
  },
  OBF004: {
    check: 'obfuscation',
    severity: 'high',
    title: 'create_function used',
    nextAction: 'Read the body string. create_function compiles a string into a function, which is eval with a different name.',
    doesNotProve: 'It does not prove hostility. Plenty of abandoned but honest plugins still call it.'
  },
  OBF005: {
    check: 'obfuscation',
    severity: 'medium',
    title: 'Long encoded blob in a PHP file',
    nextAction: 'Decode it and look. A long base64 string in source is either an embedded asset or a payload, and telling them apart takes ten seconds.',
    doesNotProve: 'It does not prove the blob is code. Inlined fonts, icons and certificates look identical to a scanner.'
  },
  OBF006: {
    check: 'obfuscation',
    severity: 'high',
    title: 'Function name assembled from concatenated fragments',
    nextAction: 'Join the fragments by hand and see which function is being hidden. Splitting a name has exactly one purpose.',
    doesNotProve: 'It does not prove the assembled call is dangerous. The technique is also used to dodge naive scanners around harmless calls.'
  },
  OBF007: {
    check: 'obfuscation',
    severity: 'high',
    title: 'assert called with a variable argument',
    nextAction: 'On older PHP, assert evaluates a string argument as code. Read what reaches the variable.',
    doesNotProve: 'It does not prove execution. Since PHP 8 assert no longer evaluates strings at all.'
  },
  OBF008: {
    check: 'obfuscation',
    severity: 'medium',
    title: 'Extremely long single line in a PHP file',
    nextAction: 'Reformat it before reading. One line of several thousand characters is the shape of a payload pasted into a real file.',
    doesNotProve: 'It does not prove injection. Minified or generated PHP has the same shape.'
  },

  // ---- core integrity ---------------------------------------------------
  CORE001: {
    check: 'core',
    severity: 'high',
    title: 'Unexpected PHP file at the web root',
    nextAction: 'Compare the root listing against the file list of the matching WordPress release. The root has a short, fixed set of PHP files.',
    doesNotProve: 'It does not prove the file is hostile. Hosts, page caches and migration tools all drop their own files at the root.'
  },
  CORE002: {
    check: 'core',
    severity: 'critical',
    title: 'Unexpected file inside wp-admin or wp-includes',
    nextAction: 'Nothing but core belongs in these directories. Replace both from the clean release rather than deleting file by file.',
    doesNotProve: 'It does not prove the file was planted. Some security plugins write their own cache files into core directories.'
  },
  CORE003: {
    check: 'core',
    severity: 'high',
    title: 'Core file modified out of step with the rest of core',
    nextAction: 'Core files are written together during an update, so they share a timestamp. One that does not was written separately.',
    doesNotProve: 'It does not prove the contents changed. Copying or syncing an install rewrites timestamps without touching bytes.'
  },
  CORE004: {
    check: 'core',
    severity: 'medium',
    title: 'Core file newer than version.php',
    nextAction: 'Take this as a place to look, not as a verdict. Compare the file against the clean release before concluding anything.',
    doesNotProve: 'It does not prove tampering. A restore from backup and a partially applied update both produce it.'
  },

  // ---- permissions -------------------------------------------------------
  PERM001: {
    check: 'permissions',
    severity: 'critical',
    title: 'wp-config.php is group or world writable',
    nextAction: 'Tighten to 0640 or 0600. Any process on the box that can write this file can read the database credentials and add code to every request.',
    doesNotProve: 'It does not prove anyone else has an account on the server. On shared hosting that is the point.'
  },
  PERM002: {
    check: 'permissions',
    severity: 'high',
    title: 'Directory is world writable',
    nextAction: 'Set directories to 0755. A 0777 directory is almost always a workaround for an ownership problem that should be fixed instead.',
    doesNotProve: 'It does not prove the directory was used. It proves anything running on the host could write to it.'
  },
  PERM003: {
    check: 'permissions',
    severity: 'medium',
    title: 'File is world writable',
    nextAction: 'Set files to 0644. World writable PHP is a persistence mechanism that survives plugin reinstalls.',
    doesNotProve: 'It does not prove the file was altered. Compare it with a clean copy to know that.'
  },
  PERM004: {
    check: 'permissions',
    severity: 'low',
    title: 'Uploads directory is not writable by its owner',
    nextAction: 'If media uploads fail with a generic message, check this before anything in the admin.',
    doesNotProve: 'It does not prove uploads fail. The web server may run as a different user than the one wp-triage sees.'
  }
};

export function make(id, evidence = {}, extra = {}) {
  const entry = CATALOGUE[id];
  if (!entry) throw new Error(`unknown finding id: ${id}`);
  return {
    id,
    check: entry.check,
    severity: entry.severity,
    title: entry.title,
    detail: extra.detail || '',
    evidence: {
      file: evidence.file || null,
      line: evidence.line || null,
      excerpt: evidence.excerpt || null
    },
    nextAction: entry.nextAction,
    doesNotProve: entry.doesNotProve
  };
}

export function severityRank(s) {
  const i = SEVERITIES.indexOf(s);
  return i === -1 ? SEVERITIES.length : i;
}
