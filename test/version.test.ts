import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getVersion } from '../src/version.ts';

const execFileAsync = promisify(execFile);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf-8')) as { version: string };

describe('getVersion', () => {
  it('returns the version baked into package.json', () => {
    assert.equal(getVersion(), pkg.version);
  });

  it('works from a non-git directory (regression: was calling git at runtime)', async () => {
    // Reproduce the bug: /tmp is not a git repo, so the old git-based
    // implementation would crash or return '0.0.0' here.
    const bin = path.join(root, 'bin/mictotext.ts');
    const { stdout } = await execFileAsync('node', [bin, 'version'], { cwd: '/tmp' });
    assert.match(stdout, /^mictotext v\d+\.\d+\.\d+(-dirty)?\n$/);
  });
});
