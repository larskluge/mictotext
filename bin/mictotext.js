#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { run } from '../src/cli.js';

const { values } = parseArgs({
  options: {
    'max-duration': { type: 'string', short: 'd' },
  },
  strict: false,
});

const maxDurationSec = values['max-duration'] ? Number(values['max-duration']) : undefined;

process.stdout.on('error', () => {});

const ac = new AbortController();
let stopping = false;

function stop() {
  if (stopping) {
    process.exit(1);
  }
  stopping = true;
  ac.abort();
}

// When stdin is a TTY, use raw mode to intercept Ctrl-C as a keypress
// instead of SIGINT. This prevents the shell from sending SIGINT to
// the entire pipeline (which would kill pbcopy/etc before we write).
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (data) => {
    if (data[0] === 0x03) stop(); // Ctrl-C
  });
}

// Fallback for non-TTY stdin
process.on('SIGINT', stop);

try {
  await run({ signal: ac.signal, maxDurationSec });
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exitCode = 1;
} finally {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }
}
