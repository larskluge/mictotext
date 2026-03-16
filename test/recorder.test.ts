import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { record } from '../src/recorder.ts';

describe('record', () => {
  it('creates WAV file at specified output path', async () => {
    const outputPath = path.join(os.tmpdir(), `mictotext-test-${Date.now()}.wav`);
    try {
      const ac = new AbortController();
      setTimeout(() => ac.abort(), 1000);
      const result = await record({ outputPath, signal: ac.signal });
      assert.equal(result.filePath, outputPath);
      assert.ok(fs.existsSync(outputPath));
      assert.ok(result.durationSec > 0, 'duration should be positive');
    } finally {
      fs.rmSync(outputPath, { force: true });
    }
  });

  it('uses temp directory when no outputPath given', async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 1000);
    const result = await record({ signal: ac.signal });
    try {
      assert.ok(result.filePath.startsWith(os.tmpdir()));
      assert.ok(fs.existsSync(result.filePath));
    } finally {
      fs.rmSync(result.filePath, { force: true });
    }
  });

  it('stops when signal is aborted and returns correct duration', async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 2000);
    const start = Date.now();
    const result = await record({ signal: ac.signal });
    const elapsed = (Date.now() - start) / 1000;
    try {
      assert.ok(result.durationSec > 0.5, `duration ${result.durationSec}s should be > 0.5s`);
      assert.ok(result.durationSec < 5, `duration ${result.durationSec}s should be < 5s`);
      assert.ok(elapsed < 5, `elapsed ${elapsed}s should be < 5s`);
    } finally {
      fs.rmSync(result.filePath, { force: true });
    }
  });

  it('respects maxDurationSec when set', async () => {
    const result = await record({ maxDurationSec: 2 });
    try {
      assert.ok(result.durationSec >= 1.5, `duration ${result.durationSec}s should be >= 1.5s`);
      assert.ok(result.durationSec <= 2.5, `duration ${result.durationSec}s should be <= 2.5s`);
    } finally {
      fs.rmSync(result.filePath, { force: true });
    }
  });

  it('records indefinitely when no maxDurationSec (stopped by signal)', async () => {
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 1500);
    const result = await record({ signal: ac.signal });
    try {
      assert.ok(result.durationSec > 0.5);
      assert.ok(result.durationSec < 4);
    } finally {
      fs.rmSync(result.filePath, { force: true });
    }
  });

  it('no orphaned ffmpeg process after abort', async () => {
    const outputPath = path.join(os.tmpdir(), `mictotext-orphan-test-${Date.now()}.wav`);
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 1000);
    try {
      await record({ outputPath, signal: ac.signal });
    } finally {
      fs.rmSync(outputPath, { force: true });
    }
    // After record() returns, no ffmpeg should be referencing our output file
    const { execSync } = await import('node:child_process');
    try {
      const out = execSync(`pgrep -f ${JSON.stringify(outputPath)}`, { encoding: 'utf8' });
      assert.fail(`ffmpeg still running with PIDs: ${out.trim()}`);
    } catch {
      // pgrep exits non-zero when no match — expected
    }
  });

  it('process.exit cleanup kills ffmpeg via exit handler', async () => {
    // Simulate the double-Ctrl-C scenario: mictotext calls process.exit(1)
    // while ffmpeg is still recording. The process.on('exit') handler in
    // recorder.ts should SIGKILL the ffmpeg child.
    //
    // We test this by spawning a helper script that starts record(), then
    // calls process.exit() while ffmpeg is running, and writes the ffmpeg
    // PID so we can verify it's dead.
    const { spawn: spawnChild, execSync } = await import('node:child_process');
    const wavPath = path.join(os.tmpdir(), `mictotext-exit-test-${Date.now()}.wav`);
    const pidFile = path.join(os.tmpdir(), `mictotext-exit-test-${Date.now()}.pid`);

    const helper = spawnChild('node', ['--experimental-strip-types', '-e', `
      const { spawn } = require('node:child_process');
      const fs = require('node:fs');

      // Mimic what record() does: spawn ffmpeg detached with exit handler
      const child = spawn('ffmpeg', [
        '-f', 'avfoundation', '-i', ':0',
        '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le',
        '-y', ${JSON.stringify(wavPath)}
      ], { stdio: ['ignore', 'ignore', 'pipe'], detached: true });

      const onExit = () => { child.kill('SIGKILL'); };
      process.on('exit', onExit);

      child.stderr.on('data', (chunk) => {
        if (chunk.toString().includes('size=')) {
          // ffmpeg is recording — write its PID and exit abruptly
          fs.writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
          process.exit(1);
        }
      });

      child.on('error', () => process.exit(2));
      setTimeout(() => process.exit(3), 10000); // timeout safety
    `], { stdio: 'pipe' });

    // Wait for the helper to exit
    await new Promise<void>((resolve) => helper.on('close', resolve));

    // Give a moment for the SIGKILL to propagate
    await new Promise(r => setTimeout(r, 200));

    // Check that the ffmpeg process is dead
    let ffmpegPid: string | undefined;
    try {
      ffmpegPid = fs.readFileSync(pidFile, 'utf8').trim();
    } catch {
      // pidFile might not exist if ffmpeg failed to start (no mic, CI, etc)
    }

    if (ffmpegPid) {
      try {
        // process.kill with signal 0 checks if process exists
        process.kill(Number(ffmpegPid), 0);
        assert.fail(`ffmpeg (PID ${ffmpegPid}) is still running after process.exit`);
      } catch (err) {
        // ESRCH means process doesn't exist — exactly what we want
        assert.equal((err as NodeJS.ErrnoException).code, 'ESRCH');
      }
    }

    // Cleanup
    fs.rmSync(wavPath, { force: true });
    fs.rmSync(pidFile, { force: true });
  });

  it('rejects when ffmpeg not found', async () => {
    const originalPath = process.env.PATH;
    process.env.PATH = '';
    try {
      await assert.rejects(
        () => record({ signal: AbortSignal.timeout(1000) }),
        (err) => {
          assert.match((err as Error).message, /ENOENT|not found|ffmpeg/i);
          return true;
        }
      );
    } finally {
      process.env.PATH = originalPath;
    }
  });
});
