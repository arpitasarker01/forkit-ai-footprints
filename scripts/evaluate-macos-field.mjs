import { evaluateMacosFieldTruthFile } from '../dist/evaluate.js';

const truthPath = process.argv[2];
if (!truthPath) throw new Error('Usage: npm run evaluate:macos -- /absolute/path/to/local-truth.json');
process.stdout.write(`${JSON.stringify(await evaluateMacosFieldTruthFile(truthPath), null, 2)}\n`);
