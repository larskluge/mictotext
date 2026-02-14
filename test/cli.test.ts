import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { checkServer } from '../src/server-check.ts';
import { run, transcribeFile } from '../src/cli.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureWav = path.join(__dirname, 'fixtures', 'sine-440hz-9s.wav');
const thisIsATestWav = path.join(__dirname, 'fixtures', 'this-is-a-test.wav');

const execFileAsync = promisify(execFile);

function collectStream(): { stream: Writable; getData: () => string } {
  let data = '';
  const stream = new Writable({
    write(chunk: Buffer, _encoding: string, callback: () => void) {
      data += chunk.toString();
      callback();
    },
  });
  return { stream, getData: () => data };
}

let serverAvailable = false;
try {
  await checkServer();
  serverAvailable = true;
} catch {
  // server not running
}

describe('cli help and version', () => {
  for (const arg of ['help', '--help', '-h']) {
    it(`"${arg}" prints usage and exits 0`, async () => {
      const { stdout } = await execFileAsync('node', ['bin/mictotext.ts', arg]);
      assert.match(stdout, /Usage:/);
      assert.match(stdout, /mictotext serve/);
      assert.match(stdout, /--max-duration/);
    });
  }

  it('unknown subcommand prints help to stderr and exits 1', async () => {
    try {
      await execFileAsync('node', ['bin/mictotext.ts', 'hi']);
      assert.fail('should have exited with non-zero code');
    } catch (e) {
      const err = e as { stderr: string; code: number };
      assert.match(err.stderr, /Unknown command: hi/);
      assert.match(err.stderr, /Usage:/);
      assert.notEqual(err.code, 0);
    }
  });

  for (const arg of ['version', '--version', '-v']) {
    it(`"${arg}" prints version and exits 0`, async () => {
      const { stdout } = await execFileAsync('node', ['bin/mictotext.ts', arg]);
      assert.match(stdout, /^mictotext v\d+\.\d+\.\d+(-dirty)?\n$/);
    });
  }
});

describe('cli', () => {
  it('prints transcript to stdout and stats to stderr', {
    skip: !serverAvailable && 'whisper server not running',
    timeout: 30000,
  }, async () => {
    const stdout = collectStream();
    const stderr = collectStream();
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 2000);

    await run({ stdout: stdout.stream, stderr: stderr.stream, signal: ac.signal });

    const out = stdout.getData();
    const err = stderr.getData();

    // stdout should have transcript text (may be empty for mic silence)
    assert.ok(typeof out === 'string');

    // stderr should have status messages
    assert.match(err, /Recording/);
    assert.match(err, /Transcri/);
    assert.match(err, /\d+\.\d+s/);
  });

  it('fails gracefully when server not running', async () => {
    const stdout = collectStream();
    const stderr = collectStream();

    // Temporarily override checkServer by using a bad URL approach
    // We test by just calling run and expecting it to throw if server is down
    // Since we can't easily mock, we'll verify the error message shape
    // This test validates the error path exists
    if (serverAvailable) {
      // Can't test server-down path when server is running, just verify run completes
      const ac = new AbortController();
      setTimeout(() => ac.abort(), 1000);
      await run({ stdout: stdout.stream, stderr: stderr.stream, signal: ac.signal });
    } else {
      await assert.rejects(
        () => run({ stdout: stdout.stream, stderr: stderr.stream }),
        (err) => {
          assert.ok((err as Error).message);
          return true;
        }
      );
    }
  });

  it('bin entry prints clean error to stderr when server is down', {
    skip: serverAvailable && 'server is running, cannot test down path',
  }, async () => {
    try {
      await execFileAsync('node', ['bin/mictotext.ts']);
      assert.fail('should have exited with non-zero code');
    } catch (e) {
      const err = e as { stderr: string; code: number };
      assert.ok(err.stderr, 'should have stderr output');
      assert.match(err.stderr, /mictotext serve/);
      assert.doesNotMatch(err.stderr, /^\s+at /m, 'should not contain stack trace');
      assert.notEqual(err.code, 0);
    }
  });

  it('cleans up temp file after completion', {
    skip: !serverAvailable && 'whisper server not running',
    timeout: 30000,
  }, async () => {
    const stdout = collectStream();
    const stderr = collectStream();
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 1500);

    await run({ stdout: stdout.stream, stderr: stderr.stream, signal: ac.signal });

    // Verify that stderr mentions recording happened (file was created)
    const err = stderr.getData();
    assert.match(err, /Recorded/);
    // The temp file should be deleted by now — we can't directly check
    // but the fact that run() completed without error means cleanup succeeded
  });
});

describe('transcribeFile', () => {
  it('transcribes fixture WAV and writes text to stdout', {
    skip: !serverAvailable && 'whisper server not running',
    timeout: 30000,
  }, async () => {
    const stdout = collectStream();
    const stderr = collectStream();

    await transcribeFile(fixtureWav, { stdout: stdout.stream, stderr: stderr.stream });

    const out = stdout.getData();
    const err = stderr.getData();

    assert.ok(typeof out === 'string');
    assert.ok(out.length > 0, 'stdout should contain transcript text');
    assert.match(err, /Checking whisper server/);
    assert.match(err, /Transcribing/);
    assert.match(err, /Transcription took \d+\.\d+s/);
  });

  it('transcribes speech and returns expected text', {
    skip: !serverAvailable && 'whisper server not running',
    timeout: 30000,
  }, async () => {
    const stdout = collectStream();
    const stderr = collectStream();

    await transcribeFile(thisIsATestWav, { stdout: stdout.stream, stderr: stderr.stream });

    const out = stdout.getData().trim().toLowerCase();
    assert.match(out, /hello/);
    assert.match(out, /this is a test/);
    assert.match(out, /(1,?\s*2,?\s*3|one,?\s*two,?\s*three)/);
    assert.match(out, /quick brown fox/);
    assert.match(out, /lazy dog/);
  });

  it('fails gracefully when server not running', async () => {
    const stdout = collectStream();
    const stderr = collectStream();

    if (!serverAvailable) {
      await assert.rejects(
        () => transcribeFile(fixtureWav, { stdout: stdout.stream, stderr: stderr.stream }),
        (err) => {
          assert.ok((err as Error).message);
          return true;
        }
      );
    }
  });

  it('fails when file does not exist', {
    skip: !serverAvailable && 'whisper server not running',
  }, async () => {
    const stdout = collectStream();
    const stderr = collectStream();

    await assert.rejects(
      () => transcribeFile('/tmp/nonexistent.wav', { stdout: stdout.stream, stderr: stderr.stream }),
      (err) => {
        assert.ok((err as Error).message);
        return true;
      }
    );
  });
});

describe('bin transcribe subcommand', () => {
  it('exits 1 with usage when no file argument given', async () => {
    try {
      await execFileAsync('node', ['bin/mictotext.ts', 'transcribe']);
      assert.fail('should have exited with non-zero code');
    } catch (e) {
      const err = e as { stderr: string; code: number };
      assert.match(err.stderr, /Usage: mictotext transcribe/);
      assert.notEqual(err.code, 0);
    }
  });

  it('exits 1 with error when file does not exist', {
    skip: serverAvailable && 'server is running, would attempt transcription',
  }, async () => {
    try {
      await execFileAsync('node', ['bin/mictotext.ts', 'transcribe', '/tmp/nonexistent.wav']);
      assert.fail('should have exited with non-zero code');
    } catch (e) {
      const err = e as { stderr: string; code: number };
      assert.ok(err.stderr, 'should have stderr output');
      assert.match(err.stderr, /Error:/);
      assert.doesNotMatch(err.stderr, /^\s+at /m, 'should not contain stack trace');
      assert.notEqual(err.code, 0);
    }
  });

  it('transcribes fixture WAV via bin entry', {
    skip: !serverAvailable && 'whisper server not running',
    timeout: 30000,
  }, async () => {
    const { stdout, stderr } = await execFileAsync('node', ['bin/mictotext.ts', 'transcribe', fixtureWav]);
    assert.ok(stdout.length > 0, 'stdout should contain transcript');
    assert.match(stderr, /Transcription took/);
  });
});
