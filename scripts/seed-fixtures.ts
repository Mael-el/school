// Backward-compatible alias — seeds the generic "demo" profile.
// Prefer: npm run seed:profile -- demo --reset
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const script = path.join(__dirname, 'seed-profile.ts');
const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', script, 'demo', ...args],
  { stdio: 'inherit', env: process.env },
);

process.exit(result.status ?? 1);
