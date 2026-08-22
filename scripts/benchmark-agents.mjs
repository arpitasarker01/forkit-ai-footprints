import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectAgentProducts } from '../dist/agents.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpusPath = path.join(root, 'benchmarks', 'agent-process-corpus.json');
const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));

assert.equal(corpus.schema_version, '1.0');
assert.ok(Array.isArray(corpus.cases) && corpus.cases.length > 0, 'benchmark corpus is empty');

let truePositive = 0;
let trueNegative = 0;
let falsePositive = 0;
let falseNegative = 0;
let wrongClass = 0;
const failures = [];

for (const [index, sample] of corpus.cases.entries()) {
  const agents = detectAgentProducts([{
    pid: index + 1,
    name: sample.process.name,
    cmd: sample.process.cmd,
  }]);
  const actual = agents[0]?.signature ?? null;
  const expected = sample.expected_signature;

  if (expected === null && actual === null) trueNegative += 1;
  else if (expected !== null && actual === expected) truePositive += 1;
  else if (expected === null) falsePositive += 1;
  else if (actual === null) falseNegative += 1;
  else wrongClass += 1;

  if (actual !== expected) failures.push({ case_id: sample.case_id, expected, actual });
}

const precisionDenominator = truePositive + falsePositive + wrongClass;
const recallDenominator = truePositive + falseNegative + wrongClass;
const metrics = {
  corpus: path.relative(root, corpusPath).replaceAll('\\', '/'),
  corpus_kind: 'curated-conformance',
  cases: corpus.cases.length,
  positive_cases: corpus.cases.filter((sample) => sample.expected_signature !== null).length,
  negative_cases: corpus.cases.filter((sample) => sample.expected_signature === null).length,
  true_positive: truePositive,
  true_negative: trueNegative,
  false_positive: falsePositive,
  false_negative: falseNegative,
  wrong_class: wrongClass,
  precision: precisionDenominator === 0 ? 1 : truePositive / precisionDenominator,
  recall: recallDenominator === 0 ? 1 : truePositive / recallDenominator,
  accuracy: (truePositive + trueNegative) / corpus.cases.length,
};

process.stdout.write(`${JSON.stringify(metrics)}\n`);
if (failures.length > 0) {
  process.stderr.write(`${JSON.stringify({ failures }, null, 2)}\n`);
  process.exit(1);
}
