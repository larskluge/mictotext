#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { DEFAULT_PORT } from '../src/config.ts';
import { run, transcribeFile } from '../src/cli.ts';
import { getVersion } from '../src/version.ts';

const version = getVersion();

const HELP = `mictotext v${version}

Record audio from Mac microphone and transcribe locally via whisperkit-cli.

Usage:
  mictotext                    Record and transcribe (default)
  mictotext transcribe <file>  Transcribe an existing audio file
  mictotext serve              Start the whisperkit-cli server
  mictotext help               Show this help message
  mictotext version            Show version

Options:
  -d, --max-duration <sec>     Maximum recording duration in seconds
  -h, --help                   Show this help message
  -v, --version                Show version
`;

function printHelp(): void {
  process.stdout.write(HELP);
}

function printVersion(): void {
  process.stdout.write(`mictotext v${version}\n`);
}

const cmd = process.argv[2];

if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
  printHelp();
} else if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
  printVersion();
} else if (cmd === 'transcribe') {
  const filePath = process.argv[3];
  if (!filePath) {
    process.stderr.write('Usage: mictotext transcribe <audio file>\n');
    process.exit(1);
  }
  process.stdout.on('error', () => {});
  try {
    await transcribeFile(filePath);
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }
} else if (cmd === 'serve') {
  const child = spawn('whisperkit-cli', ['serve', '--port', String(DEFAULT_PORT)], {
    stdio: 'inherit',
  });
  child.on('error', (err: Error) => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  });
  child.on('exit', (code: number | null) => process.exit(code ?? 1));
} else if (cmd && !cmd.startsWith('-')) {
  process.stderr.write(`Unknown command: ${cmd}\n\n`);
  process.stderr.write(HELP);
  process.exit(1);
} else {
  const { values } = parseArgs({
    options: {
      'max-duration': { type: 'string', short: 'd' },
      'help': { type: 'boolean', short: 'h' },
      'version': { type: 'boolean', short: 'v' },
    },
    strict: false,
  });

  if (values.help) { printHelp(); process.exit(0); }
  if (values.version) { printVersion(); process.exit(0); }

  const maxDurationSec: number | undefined = values['max-duration'] ? Number(values['max-duration']) : undefined;

  process.stdout.on('error', () => {});

  const ac = new AbortController();
  let stopping = false;

  function stop(): void {
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
    process.stdin.on('data', (data: Buffer) => {
      if (data[0] === 0x03) stop(); // Ctrl-C
    });
  }

  // Fallback for non-TTY stdin
  process.on('SIGINT', stop);

  try {
    await run({ signal: ac.signal, maxDurationSec });
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exitCode = 1;
  } finally {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
  }
}
