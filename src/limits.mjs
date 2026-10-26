// The limits, as data rather than as a paragraph.
//
// docs/limits.md explains the boundary of a filesystem only tool in prose.
// This table is the part a machine can hold the repository to: every entry
// here has a test in test/limits.mjs that constructs the case and asserts the
// tool behaves as stated, and `bothWays` says whether the test also
// constructs the opposite case and asserts the tool behaves differently on it.
//
// A limit asserted one way is a claim. A limit asserted both ways is a fact
// about where the tool stops, because the test would fail if the tool quietly
// started reporting the case it says it cannot see, and it would also fail if
// the tool stopped reporting the case it says it can.

export const LIMITS = [
  {
    id: 'LIMIT-TIMESTAMPS',
    title: 'A core integrity finding is about timestamps, never about bytes',
    text: 'Every core integrity check compares modification times. A core file whose contents have been replaced while its timestamp still matches the rest of core is reported as clean, and a core file whose bytes are untouched is reported the moment its timestamp is skewed by a copy or a restore. All four combinations of the two are constructed in the suite, so the reported verdict is not even weak evidence about whether a core file was modified.',
    bothWays: true
  },
  {
    id: 'LIMIT-LOG-SIZE',
    title: 'The biggest logs are the ones whose contents cannot be read',
    text: 'A log over two megabytes is not read as text, so the fatal error inside it is invisible and only its size is reported. That is the opposite way round from what a responder wants, because a log grows large when one error repeats.',
    bothWays: true
  },
  {
    id: 'LIMIT-CONSTANT-EXPRESSION',
    title: 'A constant whose value is an expression cannot be judged',
    text: 'The value of a define is read from the file, not evaluated. A literal true or false is judged. Anything else, including a value that depends on an environment variable, is reported as neither on nor off, so a site with debug genuinely on can be reported clean.',
    bothWays: true
  },
  {
    id: 'LIMIT-APPENDED-PAYLOAD',
    title: 'A payload past the first thirty two bytes of an image is not seen',
    text: 'A file with an image extension is read for its first thirty two bytes and no further. A PNG signature and its header chunk occupy thirty three, so a valid image with PHP appended after the image data, which is how a polyglot is usually built, reads as an image and is reported as nothing. The window is small on purpose, because the alternative is reading every file in a media library during an incident.',
    bothWays: true
  },
  {
    id: 'LIMIT-PERMISSION-CAP',
    title: 'Permission findings stop at twenty five of each kind',
    text: 'An install where everything is world writable reports twenty five files and twenty five directories and no more, so the report understates the problem exactly when the problem is widest. The cap exists so a report stays readable.',
    bothWays: true
  },
  {
    id: 'LIMIT-SYMLINKS',
    title: 'Nothing is read through a symbolic link',
    text: 'A link is recorded as neither a file nor a directory and is never followed, so a shell in a directory reachable only through a link is reported as nothing. Following one out of the install is how a read only tool stops being read only, so this one is a deliberate trade rather than a gap to close.',
    bothWays: true
  },
  {
    id: 'LIMIT-ONE-REASON',
    title: 'One span of a file is reported under one reason, the worst one',
    text: 'Where two reasons describe the same bytes, the tool reports the reason whose fix is larger and stays quiet about the other, so the item appears in the queue once. A must-use loader whose target both leaves the directory and sits in a writable one is reported only as the writable case, and a fatal error line that names an exhausted memory ceiling is reported as the memory ceiling and not also as a fatal error. The consequence is that the narrower finding is absent from a report where it is also true.',
    bothWays: true
  }
];

export function limitById(id) {
  return LIMITS.find((l) => l.id === id) || null;
}

export function renderLimits() {
  return LIMITS.map((l) => `${l.id}\n  ${l.title}\n  ${l.text}\n`).join('\n');
}
