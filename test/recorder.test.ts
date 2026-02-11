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
