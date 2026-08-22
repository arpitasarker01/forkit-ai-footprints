# Agent Detector Benchmark

`agent-process-corpus.json` is a labeled, curated conformance corpus for the
metadata-only process detector. It includes every supported agent signature,
explicit invocation styles, and difficult negative names and arguments
that could be misclassified by substring or compound-token matching.

Run it with:

```bash
npm run benchmark:agents
```

The command reports true positives, true negatives, false positives, false
negatives, wrong classifications, precision, recall, and accuracy. Any
misclassified fixture exits non-zero, and the benchmark also runs inside
`npm test`, so it is enforced throughout the hosted OS/Node matrix.

## Interpretation

A perfect result means the current detector conforms to this repository's
labeled cases. It does not prove perfect accuracy on real machines. The corpus
is intentionally deterministic and contains no user process lists, commands,
paths, identifiers, or telemetry.

A representative field-accuracy claim requires a separately approved protocol,
diverse consented device samples, ground-truth labeling, detector-version
tracking, and confidence intervals. Raw process commands must never be added to
this repository or uploaded as benchmark data.

## Adding a case

Add the smallest synthetic process record that reproduces the behavior. Use no
real username, home path, token, prompt, repository, hostname, or process ID.
Positive cases name the expected signature; negative cases use `null`.
