# macOS Accuracy and Release Gate

Forkit AI Footprints must not claim a global accuracy percentage or broaden its
platform support until this gate is reviewed. Passing local tests is necessary
but is not field accuracy.

## Current supported claim

- operating system: macOS only;
- current real-device evidence: one Apple Silicon Mac;
- Intel Mac: not yet field validated;
- distribution: public npm bootstrap for Apple Silicon macOS;
- network: loopback runtime APIs only, with no uploader or Forkit.dev client.

## Evidence classes

- `online`: a supported runtime API responded, or a running agent has exact
  executable, explicit module, or explicit package-runner evidence;
- `configured`: installation/configuration metadata exists, without claiming a
  process is active;
- `confirmed-running`: Ollama `/api/ps` reported the model as loaded;
- `discovered`: inventory evidence exists without proof of active execution.

Filesystem findings remain best-effort and low confidence. Process instance
counts are not independent-agent or user-session counts.

## Local labelled evaluation

Each tester creates a local JSON truth file after manually checking their Mac:

```json
{
  "schema_version": "1.0",
  "expected": {
    "agent_signatures": ["codex"],
    "tool_names": ["Codex"],
    "online_runtime_names": ["ollama"],
    "model_keys": ["ollama:example-model:latest"],
    "mcp_clients": ["Codex"]
  }
}
```

Run:

```bash
npm run evaluate:macos -- /absolute/path/to/local-truth.json
```

Testers using the packed or installed CLI run the equivalent public command:

```bash
forkit-census evaluate --truth /absolute/path/to/local-truth.json
```

The result contains aggregate counts and metrics only. It does not contain the
truth-file item names and is not uploaded.

Each tester reviews the result and may then explicitly share that result file,
but never the truth file. The coordinator aggregates a directory of reviewed
results locally:

```bash
forkit-census aggregate --results /absolute/path/to/macos-field-results
```

The aggregate reports CPU, macOS-major, and Node-major coverage plus Wilson 95%
confidence intervals. It cannot enable an accuracy claim automatically. The
coordinator must separately verify one submission per independently labelled
Mac because the privacy-preserving output contains no persistent device ID.
Different Census versions must not be pooled.

The evaluator emits aggregate counts and per-surface precision/recall locally.
It does not emit item names, raw commands, full paths, credentials, or upload
anything. Truth files must not be committed because model names can be private.

## Public-release minimums

1. At least 100 manually labelled Macs across the latest three supported macOS
   major releases and representative Apple Silicon generations.
2. Intel Mac must remain explicitly unsupported unless separately represented
   and passing.
3. At least 300 confirmed/online positive findings with no unreviewed false
   positive if a 99% precision claim is planned. Report a 95% confidence
   interval, not only the point estimate.
4. The lower 95% confidence bound for confirmed/online precision must be at
   least 99% per surface that uses that claim.
5. The lower 95% confidence bound for recall within the declared supported
   catalog must be at least 90% per surface.
6. Zero external scan requests, zero sensitive report leaks, and zero registry,
   Passport, Mint, Runtime_C2, or production writes.
7. Repeated unchanged-device item sets must be at least 99% stable; time and
   process-instance counts are excluded from this comparison.
8. Package install, tests, doctor, and isolated tarball smoke must pass on Node
   20, 22, and 24 on hosted macOS runners and on real Macs.

The tarball smoke is a separate release gate and must run before `npm publish`;
it is intentionally not nested inside npm's publication lifecycle.

These are release gates, not current achievements. No public accuracy claim is
allowed until an independently reviewed aggregate evaluation satisfies them.

## Accuracy interpretation

Different numbers have different meanings; there is no honest single accuracy
percentage for the whole product.

- **Known agents/tools:** the curated process corpus is a conformance test, not
  field prevalence. The release target is a lower 95% precision bound of 99%
  and a lower 95% supported-catalog recall bound of 90% after the field minimum.
- **Supported runtimes and loaded models:** a successful loopback API response
  is strong current-state evidence. Unsupported/custom runtimes remain outside
  recall and must not be described as absent AI.
- **Model inventory:** file metadata and runtime records are exact for evidence
  the scanner recognizes, but total recall across every possible model format
  and directory is unknown until representative field labelling.
- **Model storage:** the byte sum is exact for recognized files whose metadata
  can be read. It is not total AI disk use when a format or location is outside
  the supported catalog.
- **Agent CPU/memory:** the values are operating-system samples for strongly
  detected processes. They are not exclusive task attribution and receive no
  per-task accuracy percentage in this release.
- **Verified global installations:** App Attest plus replay/risk controls can
  strongly establish a genuine supported app installation, but this is an
  integrity result rather than detector precision. It cannot prove that every
  local artifact is meaningful or prevent all deliberate local environment
  manipulation.

The practical public target is therefore **≥99% precision and ≥90% recall
within the explicitly supported catalog**, with Wilson lower bounds satisfying
the release rules above. The current evidence does not yet authorize those
figures as achieved accuracy.

## Controlled CI is not field evidence

The labelled compatibility workflow may run tests and privacy/stability checks
on GitHub-hosted Apple Silicon and Intel macOS runners. Those machines improve
OS and architecture compatibility evidence, but they do not contain a human's
independently established inventory truth and must never be counted toward the
100-Mac field minimum.
