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
