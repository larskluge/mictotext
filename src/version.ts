import { execSync } from 'node:child_process';

export function getVersion(): string {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
  } catch {
    return '0.0.0';
  }

  let major = 0;
  let minor = 0;
  let patch = 0;

  try {
    const tag = execSync('git describe --tags --match "v*" --abbrev=0', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    const m = tag.match(/^v(\d+)\.(\d+)$/);
    if (m) {
      major = Number(m[1]);
      minor = Number(m[2]);
    }

    const countStr = execSync(`git rev-list ${tag}..HEAD --count`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    patch = Number(countStr);
  } catch {
    // No matching tag — count all commits
    const countStr = execSync('git rev-list HEAD --count', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    patch = Number(countStr);
  }

  const dirty = execSync('git status --porcelain', {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

  return `${major}.${minor}.${patch}${dirty ? '-dirty' : ''}`;
}
