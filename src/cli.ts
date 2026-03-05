import fs from 'node:fs/promises';
import type { Writable } from 'node:stream';
import { checkServer } from './server-check.ts';
import { record } from './recorder.ts';
import { transcribe } from './transcriber.ts';

export interface RunOptions {
  stdout?: Writable;
  stderr?: Writable;
  signal?: AbortSignal;
  maxDurationSec?: number;
}

export interface TranscribeFileOptions {
  stdout?: Writable;
  stderr?: Writable;
}

export async function transcribeFile(filePath: string, options: TranscribeFileOptions = {}): Promise<void> {
  const {
    stdout = process.stdout,
    stderr = process.stderr,
  } = options;

  const write = (stream: Writable, msg: string): boolean => {
    try { return stream.write(msg); } catch { return false; }
  };

  write(stderr, 'Checking whisper server...');
  try {
    await checkServer();
  } catch (err) {
    write(stderr, '\n');
    throw err;
  }
  write(stderr, ' ready.\n');

  write(stderr, 'Transcribing...\n');
  const result = await transcribe(filePath);

  if (!write(stdout, result.text + '\n')) {
    write(stderr, `Transcript: ${result.text}\n`);
  }
  write(stderr, `Transcription took ${result.transcriptionTimeSec.toFixed(2)}s\n`);
}

export async function run(options: RunOptions = {}): Promise<void> {
  const {
    stdout = process.stdout,
    stderr = process.stderr,
    signal,
    maxDurationSec,
  } = options;

  const write = (stream: Writable, msg: string): boolean => {
    try { return stream.write(msg); } catch { return false; /* EPIPE — pipe closed */ }
  };

  // 1. Check server
  write(stderr, 'Checking whisper server...');
  try {
    await checkServer();
  } catch (err) {
    write(stderr, '\n');
    throw err;
  }
  write(stderr, ' ready.');

  // 2. Record
  let filePath: string | undefined;
  try {
    const recordResult = await record({
      signal,
      maxDurationSec,
      onReady: () => write(stderr, ' Recording now... (press Ctrl-C to stop)\n'),
    });
    filePath = recordResult.filePath;

    write(stderr, `Recorded ${recordResult.durationSec.toFixed(1)}s of audio.\n`);

    if (recordResult.durationSec < 0.1) {
      write(stderr, 'Recording too short, nothing to transcribe.\n');
      return;
    }

    // 3. Transcribe
    write(stderr, 'Transcribing...\n');
    const result = await transcribe(filePath);

    if (!write(stdout, result.text + '\n')) {
      // Pipe broken (e.g. Ctrl-C killed downstream process) — print to stderr
      write(stderr, `Transcript: ${result.text}\n`);
    }
    write(stderr, `Transcription took ${result.transcriptionTimeSec.toFixed(2)}s\n`);
  } finally {
    // 4. Cleanup
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
