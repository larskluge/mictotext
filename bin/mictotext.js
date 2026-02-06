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

const ac = new AbortController();
let stopping = false;

process.on('SIGINT', () => {
  if (stopping) {
    process.exit(1);
  }
  stopping = true;
  ac.abort();
});

try {
  await run({ signal: ac.signal, maxDurationSec });
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
}
