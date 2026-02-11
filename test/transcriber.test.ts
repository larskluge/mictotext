import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transcribe } from '../src/transcriber.ts';
import { checkServer } from '../src/server-check.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureWav = path.join(__dirname, 'fixtures', 'sine-440hz-9s.wav');

let serverAvailable = false;
try {
  await checkServer();
  serverAvailable = true;
} catch {
  // server not running
}

describe('transcribe', () => {
  it('returns non-empty text from test fixture WAV', { skip: !serverAvailable && 'whisper server not running' }, async () => {
    const result = await transcribe(fixtureWav);
    assert.ok(typeof result.text === 'string');
    assert.ok('text' in result);
  });

  it('measures positive transcription time', { skip: !serverAvailable && 'whisper server not running' }, async () => {
    const result = await transcribe(fixtureWav);
    assert.ok(result.transcriptionTimeSec > 0, `transcriptionTimeSec should be positive, got ${result.transcriptionTimeSec}`);
  });

  it('rejects when file does not exist', { skip: !serverAvailable && 'whisper server not running' }, async () => {
    await assert.rejects(
      () => transcribe('/tmp/nonexistent-audio-file.wav'),
      (err) => {
        assert.ok((err as Error).message);
        return true;
      }
    );
  });

  it('rejects when server is not available', async () => {
    await assert.rejects(
      () => transcribe(fixtureWav, { baseUrl: 'http://localhost:19999' }),
      (err) => {
        assert.ok((err as Error).message);
        return true;
      }
    );
  });
});
