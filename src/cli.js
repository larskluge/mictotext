import fs from 'node:fs/promises';
import { checkServer } from './server-check.js';
import { record } from './recorder.js';
import { transcribe } from './transcriber.js';

export async function run(options = {}) {
  const {
    stdout = process.stdout,
    stderr = process.stderr,
    signal,
    maxDurationSec,
  } = options;

  const write = (stream, msg) => stream.write(msg);

  // 1. Check server
  write(stderr, 'Checking whisper server...\n');
  await checkServer();
  write(stderr, 'Server ready.\n');

  // 2. Record
  write(stderr, 'Recording... (press Ctrl-C to stop)\n');

  let filePath;
  try {
    const recordResult = await record({ signal, maxDurationSec });
    filePath = recordResult.filePath;

    write(stderr, `Recorded ${recordResult.durationSec.toFixed(1)}s of audio.\n`);

    if (recordResult.durationSec < 0.1) {
      write(stderr, 'Recording too short, nothing to transcribe.\n');
      return;
    }

    // 3. Transcribe
    write(stderr, 'Transcribing...\n');
    const result = await transcribe(filePath);

    write(stdout, result.text + '\n');
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
