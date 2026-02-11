/**
 * log.mjs
 *
 * Safe logger that redacts secrets before printing.
 * Drop-in replacement for console.log/warn/error in autopilot modules.
 */

import { redact } from './redact.mjs';

function format(...args) {
  return args.map(a => {
    if (typeof a === 'string') return redact(a);
    if (a instanceof Error) return redact(a.message);
    try { return redact(JSON.stringify(a)); } catch { return String(a); }
  }).join(' ');
}

export const log = {
  info: (...args) => console.log(format(...args)),
  warn: (...args) => console.warn(format(...args)),
  error: (...args) => console.error(format(...args)),
};

export default log;
