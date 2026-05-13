# AGENTS.md

Guidance for future coding agents working in this repository.

## Project Shape

This is a TypeScript ESM port of mini-swe-agent. The core design is intentionally small:

1. `DefaultAgent` keeps a linear message history.
2. A model adapter returns one or more parsed actions.
3. `LocalEnvironment` executes each action in a fresh shell process.
4. Tool observations are appended to the message history.
5. The loop repeats until an `exit` message is produced.

Important files:

- `src/agent/default.ts` - main non-interactive agent loop.
- `src/agent/interactive.ts` - confirm/yolo/human mode behavior.
- `src/model/openai.ts` - official OpenAI SDK adapter.
- `src/model/actions.ts` - text-tool parsing and observation formatting.
- `src/environment/local.ts` - local shell execution.
- `src/config.ts` and `config/mini.yaml` - default config and YAML/override loading.
- `src/cli.ts` - CLI entrypoint.

## Commands

Run these before handing off changes:

```bash
npm run typecheck
npm run build
npm test
```

Development CLI:

```bash
npm run dev -- --model <model> --task "<task>" --yolo
```

Built CLI:

```bash
node dist/cli.js --model <model> --task "<task>" --yolo
```

## Tool Calling

All models use a single text-based tool protocol. Every tool call is a fenced block with `tool=<name>` on the opening fence and `\`\`\`tool` as the closing fence. Some tools take a single quoted argument on the opening fence:

````text
```tool=shell
pwd
```tool
````

````text
```tool=read("src/index.ts")
```tool
````

````text
```tool=write("notes.txt")
hello
```tool
````

````text
```tool=end
```tool
````

Supported tools:

- `shell` — body is the shell command.
- `read` — argument is the file path; body ignored; observation carries the file contents.
- `write` — argument is the file path; body becomes the file contents; observation is empty.
- `end` — signals task submission; body ignored.

`read` and `write` paths are confined to the agent's working directory by `LocalEnvironment.resolveInsideCwd` (`src/environment/local.ts`) — lexical resolution via `path.resolve` plus a `cwd` prefix check. This is a hard limit; do not bypass it. Quotes and newlines are disallowed inside the path argument so the parser regex stays simple.

Do not regress this grammar to the old `mswea_bash_command` format or to OpenAI-style structured tool calls. The `tool=<tool name>` header exists so future tools can be added without changing the block format.

Parser behavior belongs in `src/model/actions.ts`; add tests in `tests/actions.test.ts` for any grammar change.

## Shell Execution

`LocalEnvironment` runs every action in a fresh process. Directory changes and environment variable changes do not persist across actions unless they are encoded into each command or written to the filesystem.

Default shell config is `auto`:

- Unix-like systems: `bash -lc`
- Windows: `pwsh.exe`, falling back to `powershell.exe`

Custom shell config shape:

```yaml
environment:
  shell:
    executable: bash
    args: ["-lc"]
```

Completion is signaled by the model emitting a `tool=end` block; `src/agent/default.ts` intercepts that action and raises `Submitted`.

## System Prompt Placement

`agent.systemPromptPlacement` supports:

- `system` - send the rendered system prompt as a system-role message.
- `first_user` - prepend the rendered system prompt to the first user message and send no system-role message.

Keep tests for this behavior in `tests/agent.test.ts`.

## Config Conventions

Config mirrors the Python project shape:

- `agent.*`
- `model.*`
- `environment.*`
- `run.*`

CLI `-c/--config` accepts YAML files and dotted key-value overrides:

```bash
-c mini -c agent.mode=yolo -c environment.timeoutMs=1000
```

If adding config keys, update both `src/config.ts` defaults and `config/mini.yaml` when the key is user-facing.

## Implementation Notes

- This project uses TypeScript ESM with `moduleResolution: NodeNext`; include `.js` extensions in relative imports.
- Keep generated `dist/` and `node_modules/` out of git.
- Do not add LiteLLM. This port intentionally uses the official `openai` SDK.
- OpenAI-compatible providers are supported by `src/model/openai.ts`, but provider URLs are never inferred. Use `OPENAI_BASE_URL` or explicit `model.baseURL` for non-OpenAI providers.
- Never commit API keys into YAML config. Use `OPENAI_API_KEY` or explicit local-only `model.apiKey`.
- CLI provider error formatting lives in `src/cli-error.ts`; preserve `--debug` support for structured upstream errors and rate-limit headers.
- Dollar cost limits are intentionally not implemented. Token usage may be recorded when returned by OpenAI.
- Keep public exported types in `src/index.ts` when adding reusable classes or helpers.
