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
- `src/model/openai.ts` - official OpenAI SDK adapters.
- `src/model/actions.ts` - tool schema, tool-call parsing, text-tool parsing, observation formatting.
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

The initial supported tool is named `shell`, not `bash`.

OpenAI tool-calling adapter:

```json
{
  "name": "shell",
  "arguments": {
    "command": "pwd"
  }
}
```

Text adapter blocks must include both the opening fence and the closing fence:

````text
```tool=shell
pwd
```
````

Do not regress this grammar to the old `mswea_bash_command` format. The `tool=<tool name>` header exists so future tools can be added without changing the text block format.

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

Completion is detected when command output starts with:

```text
COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT
```

The command must exit with return code `0`.

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
- Dollar cost limits are intentionally not implemented. Token usage may be recorded when returned by OpenAI.
- Keep public exported types in `src/index.ts` when adding reusable classes or helpers.

