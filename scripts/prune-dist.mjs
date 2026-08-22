import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(target);
      if (fs.readdirSync(target).length === 0) fs.rmdirSync(target);
      continue;
    }
    if (entry.name.includes('.test.') || entry.name.endsWith('.map')) fs.rmSync(target);
  }
}

walk(dist);
