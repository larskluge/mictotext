import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = path.join(root, 'package.json');
const syncScript = path.join(root, 'scripts/sync-version.ts');

const isDirty = (() => {
  try {
    return execSync('git status --porcelain', { cwd: root, encoding: 'utf-8' }).trim() !== '';
  } catch {
    return false;
  }
})();

describe('sync-version.ts', () => {
  let savedPkg: string;

  before(() => { savedPkg = readFileSync(pkgPath, 'utf-8'); });
  after(() => { writeFileSync(pkgPath, savedPkg); });

  it('prepack mode (no flag): dirty tree → -dirty suffix in package.json', {
    skip: !isDirty && 'working tree is clean',
  }, async () => {
    await execFileAsync('node', [syncScript], { cwd: root });
    const { version } = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    assert.match(version, /-dirty$/);
  });

  it('pre-commit mode (--pre-commit): dirty tree → no -dirty suffix in package.json', {
    skip: !isDirty && 'working tree is clean',
  }, async () => {
    await execFileAsync('node', [syncScript, '--pre-commit'], { cwd: root });
    const { version } = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    assert.match(version, /^\d+\.\d+\.\d+$/);
  });

  it('pre-commit mode anticipates the pending commit (+1 patch vs prepack)', {
    skip: !isDirty && 'working tree is clean',
  }, async () => {
    await execFileAsync('node', [syncScript], { cwd: root });
    const { version: prepack } = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    await execFileAsync('node', [syncScript, '--pre-commit'], { cwd: root });
    const { version: preCommit } = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    const prepackPatch = Number(prepack.replace(/-dirty$/, '').split('.')[2]);
    const preCommitPatch = Number(preCommit.split('.')[2]);
    assert.equal(preCommitPatch, prepackPatch + 1);
  });
});
