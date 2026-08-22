import fs from 'node:fs';

if (process.platform !== 'win32') {
  fs.chmodSync(new URL('../dist/cli.js', import.meta.url), 0o755);
}
