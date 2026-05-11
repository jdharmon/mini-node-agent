# node-agent

A minimal TypeScript software engineering agent inspired by mini-swe-agent.

The agent keeps a linear message history, asks an OpenAI-compatible model for a tool use, executes that tool locally, appends the observation, and repeats until the model submits.

## Usage

```bash
npm install
npm run build
OPENAI_API_KEY=... node dist/cli.js --model gpt-4.1-mini --task "Print the current directory" --yolo
```

For development:

```bash
npm run dev -- --model gpt-4.1-mini --task "Print the current directory" --yolo
```

OpenAI-compatible providers are supported through the same adapter. For OpenRouter-style model names such as `google/...`, set `OPENAI_API_KEY` to the provider key and explicitly set `OPENAI_BASE_URL` or `model.baseURL`:

```bash
export OPENAI_API_KEY=...
export OPENAI_BASE_URL=https://openrouter.ai/api/v1
npm run dev -- --model google/gemma-4-31b-it:free --task "Print the current directory"
```

## Configuration

`node-agent` has built-in defaults, accepts YAML config files, and supports dotted key-value overrides from the CLI.

Config is merged in this order:

1. Built-in defaults from `src/config.ts`
2. Each `-c/--config` entry in the order provided
3. Dedicated CLI flags such as `--model`, `--task`, `--yolo`, and `--output`

Later values override earlier values.

### CLI Flags

```bash
node dist/cli.js \
  --model gpt-4.1-mini \
  --task "Fix the failing test" \
  --model-class openai \
  --environment local \
  --yolo \
  --output ~/.node-agent/last_run.traj.json
```

Common flags:

- `-t, --task <task>` - task/problem statement. If omitted, the CLI prompts.
- `-m, --model <model>` - OpenAI model name.
- `--model-class <class>` - `openai` or `openai_text`.
- `--environment <class>` - currently `local`.
- `-c, --config <spec>` - YAML config file or dotted key-value override. Can be repeated.
- `-y, --yolo` - execute model commands without confirmation.
- `-o, --output <path>` - write the trajectory JSON file.
- `--exit-immediately` - do not prompt for a follow-up task when the model submits.
- `--system-prompt-placement <placement>` - `system` or `first_user`.
- `--debug` - print structured provider errors, relevant headers, and stack traces.

### YAML Config Files

The built-in config file is `config/mini.yaml`. You can pass it by name:

```bash
node dist/cli.js -c mini --model gpt-4.1-mini --task "Print pwd"
```

You can also pass a path:

```bash
node dist/cli.js -c ./my-agent.yaml
```

Config lookup checks the current directory, `NODE_AGENT_CONFIG_DIR` when set, and the package `config/` directory.

Example config:

```yaml
run:
  task: "Inspect the current repository"

agent:
  mode: confirm
  stepLimit: 20
  confirmExit: true
  systemPromptPlacement: system
  outputPath: /tmp/node-agent-run.traj.json
  systemTemplate: |
    You are a careful software engineering agent.
  instanceTemplate: |
    Please solve this issue: {{task}}

    Use the shell tool to inspect, edit, and verify.

model:
  modelClass: openai
  modelName: gpt-4.1-mini
  modelKwargs:
    temperature: 0
  observationTemplate: |
    <returncode>{{output.returncode}}</returncode>
    <output>
    {{output.output}}</output>
  formatErrorTemplate: |
    Tool call error:

    {{error}}

environment:
  environmentClass: local
  cwd: /path/to/project
  timeoutMs: 30000
  shell: auto
  env:
    PAGER: cat
    MANPAGER: cat
```

### Dotted Overrides

Any `-c` entry containing `=` is treated as a dotted override:

```bash
node dist/cli.js \
  -c mini \
  -c agent.mode=yolo \
  -c model.modelName=\"gpt-4.1-mini\" \
  -c model.modelKwargs.temperature=0 \
  -c environment.timeoutMs=10000
```

Values are parsed as JSON when possible, so numbers, booleans, arrays, objects, and quoted strings work:

```bash
-c agent.stepLimit=30
-c agent.confirmExit=false
-c environment.env='{"DEBUG":"1"}'
```

### Agent Options

```yaml
agent:
  mode: confirm
  stepLimit: 0
  costLimit: 0
  confirmExit: true
  whitelistActions: []
  systemPromptPlacement: system
  outputPath: /tmp/node-agent-run.traj.json
  systemTemplate: |
    You are a helpful assistant that can interact with a computer.
  instanceTemplate: |
    Please solve this issue: {{task}}
```

- `mode`: `confirm`, `yolo`, or `human`.
- `stepLimit`: maximum model calls. `0` means unlimited.
- `costLimit`: accepted for config compatibility, but dollar cost enforcement is not implemented.
- `confirmExit`: when true, prompt before exiting after submission.
- `whitelistActions`: regex strings that skip confirmation in `confirm` mode.
- `systemPromptPlacement`: `system` sends a system-role message; `first_user` prepends the system prompt to the first user message.
- `systemTemplate` and `instanceTemplate`: simple `{{key}}` substitution using task, environment, model, and agent variables.

### Model Options

```yaml
model:
  modelClass: openai
  modelName: gpt-4.1-mini
  modelKwargs:
    temperature: 0
  apiKey: null
  baseURL: null
```

- `modelClass: openai` uses OpenAI Chat Completions tool calling.
- `modelClass: openai_text` uses plain assistant text and parses fenced tool blocks.
- `modelName` can also come from `NODE_AGENT_MODEL_NAME` or `OPENAI_MODEL`.
- `apiKey` defaults to `OPENAI_API_KEY`.
- `baseURL` can point at an OpenAI-compatible API. It defaults to `OPENAI_BASE_URL` when set.
- `modelKwargs` is spread into `client.chat.completions.create(...)`.

OpenRouter example:

```bash
export OPENAI_API_KEY=...
export OPENAI_BASE_URL=https://openrouter.ai/api/v1
npm run dev -- \
  --model google/gemma-4-31b-it:free \
  --task "Print the current directory"
```

If OpenRouter returns `429 Provider returned error`, rerun with `--debug`:

```bash
npm run dev -- \
  --model google/gemma-4-31b-it:free \
  --task "Print the current directory" \
  --debug
```

The debug output prints structured fields such as status, request id, retry headers, and provider metadata when the OpenAI-compatible endpoint returns them.

Generic OpenAI-compatible endpoint example:

```bash
export OPENAI_API_KEY=...
export OPENAI_BASE_URL=https://api.example.test/v1
npm run dev -- --model provider/model-name --task "Print pwd"
```

### Text Adapter Format

When using `openai_text`, every tool call must be a fenced block with a closing fence:

````text
```tool=shell
pwd
```
````

The `tool=<tool name>` header is intentional so future tools can be added without changing the text grammar. The only supported tool today is `shell`.

### Environment Options

```yaml
environment:
  environmentClass: local
  cwd: /path/to/project
  timeoutMs: 30000
  shell: auto
  env:
    PAGER: cat
```

- `environmentClass`: currently only `local`.
- `cwd`: working directory for command execution.
- `timeoutMs`: per-command timeout in milliseconds.
- `env`: environment variables merged into the child process environment.
- `shell`: `auto` or an explicit shell command.

Explicit shell config:

```yaml
environment:
  shell:
    executable: bash
    args: ["-lc"]
```

PowerShell example:

```yaml
environment:
  shell:
    executable: pwsh
    args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"]
```

Each action runs in a fresh process. `cd` and environment variable changes do not persist between actions unless the command writes state to the filesystem.

## Models

The default model adapter uses the official OpenAI SDK with Chat Completions tool calling. It exposes one initial tool:

```json
{
  "name": "shell",
  "arguments": {
    "command": "pwd"
  }
}
```

The text adapter can be selected with:

```bash
node dist/cli.js --model-class openai_text --model gpt-4.1-mini --task "Print pwd"
```

Text tool calls must use a fenced block with the closing fence:

````text
```tool=shell
pwd
```
````

## Shells

The local environment runs each action in a fresh shell process. The default shell is `auto`, which uses `bash -lc` on Unix-like systems and PowerShell on Windows. You can configure the shell in YAML:

```yaml
environment:
  shell:
    executable: bash
    args: ["-lc"]
```

## Verification

```bash
npm run typecheck
npm run build
npm test
```
