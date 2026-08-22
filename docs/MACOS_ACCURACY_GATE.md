# macOS Accuracy and Release Gate

Forkit Census must remain unpublished and `future/investigate` until this gate
is reviewed. Passing local tests is necessary but is not field accuracy.

## Current supported claim

- operating system: macOS only;
- current real-device evidence: one Apple Silicon Mac;
- Intel Mac: not yet field validated;
- distribution: local source/tarball testing only;
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
