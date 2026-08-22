# Forkit Census macOS Field Test

This is a private experimental test. Forkit Census is not production software,
is not published on npm, and has no uploader. Do not test it on a machine where
you are unable to review the local metadata it will inspect.

## What the test reads

Census reads process metadata, known application/configuration-path existence,
supported model-file metadata, known MCP configuration entry counts, and
supported loopback runtime APIs. It does not read model bytes, retain raw
commands, emit full paths or MCP values, authenticate, or contact Forkit.dev.

## Requirements

- a Mac you are authorized to inspect;
- Node.js 20, 22, or 24 and npm;
- the provided `forkit-census-0.1.0.tgz` test artifact;
- its SHA-256 checksum from the test coordinator.

Verify and install the artifact:

```bash
shasum -a 256 ./forkit-census-0.1.0.tgz
npm install -g ./forkit-census-0.1.0.tgz
forkit-census doctor
```

Stop if the checksum differs or `doctor` does not identify macOS.

## Create independent truth

Copy `examples/macos-truth.template.json` outside the repository and fill it in
after manually checking the Mac. Do this before looking at the Census scan so
the tool does not define its own truth.

- `agent_signatures`: supported agent processes actually running now. Supported
  values are `codex`, `claude`, `aider`, `openhands`, `goose`, `cursor`,
  `windsurf`, `gemini-cli`, `opencode`, `openclaw`, `cline`, `roo-code`,
  `mcp-server`, `langchain`, `langgraph`, `crewai`, `autogen`, `llamaindex`,
  `agno`, `pydantic-ai`, and `smolagents`.
- `tool_names`: supported installed/configured products. Supported values are
  `Claude Code`, `Codex`, `Cursor`, `Windsurf`, `Gemini CLI`, `GitHub Copilot`,
  `OpenCode`, `OpenClaw`, `Jan`, `LM Studio`, and `Zed`.
- `online_runtime_names`: supported runtime APIs responding locally now:
  `ollama`, `lmstudio`, or `openai-compatible`.
- `model_keys`: every expected supported model as `runtime:model-name`, using
  the exact name shown by the runtime or local model manager.
- `mcp_clients`: supported clients with a non-empty known MCP configuration.
  Use `Claude Code`, `Codex`, `Cursor`, `VS Code`, `VS Code Insiders`,
  `Windsurf`, or `Zed`.

Use an empty array when nothing should be detected for a surface. Keep this
truth file private; it may contain model names.

## Run and review

```bash
forkit-census evaluate \
  --truth /absolute/path/to/local-truth.json \
  --output ./macos-evaluation.json
```

The result contains only aggregate true-positive, false-positive, and
false-negative counts, plus macOS major version, CPU architecture, Node major,
and product version. It contains no truth item names and is not uploaded.

Open `macos-evaluation.json` before sharing it. Share only that evaluation file
if you separately consent. Never send the truth file, raw scan output, terminal
history, configuration files, or screenshots containing private names.

## Coordinator aggregation

Place explicitly shared evaluation JSON files in one directory and run:

```bash
forkit-census aggregate \
  --results /absolute/path/to/macos-field-results \
  --output ./macos-field-aggregate.json
```

The aggregate includes coverage counts and Wilson 95% confidence intervals.
It deliberately keeps `field_accuracy_claim_allowed` false. A human review
against `docs/MACOS_ACCURACY_GATE.md` is required before any accuracy claim or
release decision. The coordinator must independently track one result per Mac;
the result format deliberately contains no persistent device identifier and
therefore cannot automatically detect repeated submissions from one machine.
Results from different Census versions are rejected rather than pooled.
