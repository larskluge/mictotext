import { readFileSync, writeFileSync } from 'node:fs';
import { getVersion } from '../src/version.ts';

const raw = getVersion();
const dirty = raw.endsWith('-dirty');
let version = raw.replace(/-dirty$/, '');

// When dirty (e.g. called from pre-commit hook), the pending commit will
// increment the patch count by one, so anticipate that.
if (dirty) {
  const parts = version.split('.');
  parts[2] = String(Number(parts[2]) + 1);
  version = parts.join('.');
}

const path = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(path, 'utf-8'));
pkg.version = version;
writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');

process.stdout.write(`package.json version → ${version}\n`);
