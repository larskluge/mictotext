import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const execFileAsync = promisify(execFile);
const WAV_HEADER_SIZE = 44;
const BYTES_PER_SEC = 32000; // 16kHz * 1 channel * 2 bytes (pcm_s16le)

export interface RecordOptions {
  maxDurationSec?: number;
  signal?: AbortSignal;
  outputPath?: string;
  onReady?: () => void;
}

export interface RecordResult {
  filePath: string;
  durationSec: number;
}

export async function record(options: RecordOptions = {}): Promise<RecordResult> {
  const { maxDurationSec, signal, outputPath, onReady } = options;

  const filePath =
    outputPath ??
    path.join(os.tmpdir(), `mictotext-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.wav`);

  const args = [
    '-f', 'avfoundation',
    '-i', ':0',
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
  ];

  if (maxDurationSec != null) {
    args.push('-t', String(maxDurationSec));
  }

  args.push('-y', filePath);

  await new Promise<void>((resolve, reject) => {
    // detached: true puts ffmpeg in its own process group so terminal
    // Ctrl-C doesn't kill it directly — we send SIGINT ourselves, giving
    // ffmpeg time to finalize the WAV header before exiting.
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'], detached: true });

    let readyFired = false;
    const fireReady = () => {
      if (!readyFired) {
        readyFired = true;
        onReady?.();
      }
    };

    // ffmpeg prints "size=" progress lines to stderr once recording begins
    child.stderr!.on('data', (chunk: Buffer) => {
      if (!readyFired && chunk.toString().includes('size=')) {
        fireReady();
      }
    });

    child.on('error', reject);

    child.on('close', (code: number | null) => {
      fireReady(); // in case stderr never showed "size="
      // ffmpeg exits 255 when killed by SIGINT, which is expected
      if (code === 0 || code === 255 || code === null) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    if (signal) {
      const onAbort = () => {
        child.kill('SIGINT');
      };
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener('abort', onAbort, { once: true });
      }
    }
  });

  const durationSec = await getDuration(filePath);

  return { filePath, durationSec };
}

async function getDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      filePath,
    ]);
    const dur = parseFloat(stdout.trim());
    if (!isNaN(dur)) return dur;
  } catch {
    // ffprobe fails on truncated WAV — fall back to file size
  }
  const { size } = fs.statSync(filePath);
  return Math.max(0, (size - WAV_HEADER_SIZE) / BYTES_PER_SEC);
}
