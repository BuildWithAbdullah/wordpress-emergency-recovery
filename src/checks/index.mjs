import * as shape from './shape.mjs';
import * as config from './config.mjs';
import * as logs from './logs.mjs';
import * as updates from './updates.mjs';
import * as dropins from './dropins.mjs';
import * as htaccess from './htaccess.mjs';
import * as output from './output.mjs';
import * as uploads from './uploads.mjs';
import * as obfuscation from './obfuscation.mjs';
import * as core from './core.mjs';
import * as permissions from './permissions.mjs';

export const CHECKS = [shape, config, logs, updates, dropins, htaccess, output, uploads, obfuscation, core, permissions];

export function checkById(id) {
  return CHECKS.find((c) => c.id === id) || null;
}
