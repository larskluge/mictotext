import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

// --pre-commit: anticipate the pending commit (+1 patch, no -dirty suffix)
// default (prepack): record current state as-is (-dirty suffix if dirty)
const preCommit = process.argv.includes('--pre-commit');

function computeVersionFromGit(): string {
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

  if (dirty) {
    if (preCommit) {
      // The pending commit will increment the count, so anticipate that.
      patch += 1;
      return `${major}.${minor}.${patch}`;
    } else {
      return `${major}.${minor}.${patch}-dirty`;
    }
  }

  return `${major}.${minor}.${patch}`;
}

const version = computeVersionFromGit();
const pkgPath = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

process.stdout.write(`package.json version → ${version}\n`);
