#!/usr/bin/env node
/* 
 * Guardrail: Verify coupling between menu.js (dispatch) and room.js (listeners)
 * Checks:
 *  - menu.js dispatches CustomEvent 'ep:auto-reveal-toggle' with detail.on (supports shorthand { on })
 *  - menu.js dispatches CustomEvent 'ep:topic-toggle'       with detail.on (supports shorthand { on })
 *  - menu.js dispatches CustomEvent 'ep:participation-toggle' with detail.estimating (supports shorthand { estimating })
 *  - room.js adds listeners for all three events
 *
 * Usage:
 *   node scripts/check-menu-toggle-events.js
 *
 * Config (env overrides):
 *   EP_MENU_JS=path/to/menu.js
 *   EP_ROOM_JS=path/to/room.js
 *   EP_CHECK_LOG=1   -> verbose logs
 */

const fs = require('fs');
const path = require('path');

const MENU_JS = process.env.EP_MENU_JS || path.join('src','main','resources','static','js','menu.js');
const ROOM_JS = process.env.EP_ROOM_JS || path.join('src','main','resources','static','js','room.js');
const VERBOSE = process.env.EP_CHECK_LOG === '1';

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`✗ Cannot read file: ${file}`);
    console.error(`  -> ${e.message}`);
    process.exit(2);
  }
}

function around(str, idx, span=260) {
  const start = Math.max(0, idx - 80);
  const end = Math.min(str.length, idx + span);
  return str.slice(start, end);
}

function hasDispatchWithDetail(source, eventName, requiredKey) {
  let ok = false;
  let lastIdx = 0;
  while (true) {
    const i = source.indexOf(eventName, lastIdx);
    if (i === -1) break;
    const windowStr = around(source, i, 520);

    const mentionsCustomEvent = /new\s+CustomEvent\s*\(/.test(windowStr);
    const mentionsDispatch = /(?:^|[\s.;])(?:document|window)?\.?dispatchEvent\s*\(/.test(windowStr)
      || /dispatchEvent\s*\(/.test(windowStr);

    // Look for a `detail: { ... }` block and accept both "key:" and shorthand "{ key }"
    let hasKey = false;
    const detailIdx = windowStr.search(/detail\s*:/);
    if (detailIdx !== -1) {
      const tail = windowStr.slice(detailIdx, detailIdx + 260); // small window after 'detail:'
      const key = requiredKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Matches "key:" (explicit) OR "{ key }" / ", key," (shorthand inside object)
      const explicit = new RegExp(`\\b${key}\\b\\s*:`).test(tail);
      const shorthand = new RegExp(`[{,]\\s*${key}\\s*(?:[,}])`).test(tail);
      hasKey = explicit || shorthand;
      if (VERBOSE) {
        console.info(`  detail check for '${eventName}' → explicit:${explicit} shorthand:${shorthand}`);
      }
    }

    if (mentionsCustomEvent && mentionsDispatch && hasKey) {
      ok = true;
      if (VERBOSE) console.info(`  → Found '${eventName}' with detail.${requiredKey}`);
      break;
    }

    lastIdx = i + eventName.length;
  }
  return ok;
}

function hasListener(source, eventName) {
  const re = new RegExp(`addEventListener\\s*\\(\\s*['"]${eventName}['"]\\s*,`);
  const ok = re.test(source);
  if (VERBOSE) console.info(ok 
    ? `  → Listener found for '${eventName}'` 
    : `  → Listener MISSING for '${eventName}'`);
  return ok;
}

// --- Run checks ---
const menuSrc = read(MENU_JS);
const roomSrc = read(ROOM_JS);

const checks = [
  {
    name: "auto-reveal toggle dispatch (detail.on)",
    ok: hasDispatchWithDetail(menuSrc, 'ep:auto-reveal-toggle', 'on')
  },
  {
    name: "topic toggle dispatch (detail.on)",
    ok: hasDispatchWithDetail(menuSrc, 'ep:topic-toggle', 'on') // topic must send { on }
  },
  {
    name: "participation toggle dispatch (detail.estimating)",
    ok: hasDispatchWithDetail(menuSrc, 'ep:participation-toggle', 'estimating')
  },
  {
    name: "room listener: ep:auto-reveal-toggle",
    ok: hasListener(roomSrc, 'ep:auto-reveal-toggle')
  },
  {
    name: "room listener: ep:topic-toggle",
    ok: hasListener(roomSrc, 'ep:topic-toggle')
  },
  {
    name: "room listener: ep:participation-toggle",
    ok: hasListener(roomSrc, 'ep:participation-toggle')
  },
];

let failed = 0;
for (const c of checks) {
  if (c.ok) {
    console.log(`✓ ${c.name}`);
  } else {
    failed++;
    console.error(`✗ ${c.name}`);
  }
}

if (failed > 0) {
  console.error(`\nFailed checks: ${failed}`);
  console.error(
    'Hints:\n' +
    ' - Ensure menu.js dispatches: dispatchEvent(new CustomEvent("<event>", { detail: { ... } }))\n' +
    ' - Supports shorthand detail: { on } / { estimating } (no colon needed)\n' +
    ' - Required detail keys: auto/topic => detail.on, participation => detail.estimating\n' +
    ' - Run with EP_CHECK_LOG=1 for verbose hints.'
  );
  process.exit(1);
} else {
  console.log('\nAll menu/room toggle contracts look good. ✅');
}
