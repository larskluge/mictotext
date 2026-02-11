import { readFileSync, writeFileSync } from 'node:fs';
import { getVersion } from '../src/version.ts';

const path = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(path, 'utf-8'));
const version = getVersion();

pkg.version = version;
writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');

process.stdout.write(`package.json version → ${version}\n`);
