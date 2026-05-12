import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { parseScalar, recursiveMerge, setDottedValue } from "./utils.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export const DEFAULT_OUTPUT_PATH = join(homedir(), ".mini-node-agent", "last_run.traj.json");

export const DEFAULT_CONFIG: Record<string, unknown> = {
  run: {
    task: undefined
  },
  agent: {
    systemTemplate: "You are a helpful assistant that can interact with a computer.",
    instanceTemplate: `Please solve this issue: {{task}}

You can execute shell commands and edit files to implement the necessary changes.

## Command Execution Rules

You are operating in an environment where:
1. You issue at least one shell command.
2. The system executes the command in a fresh shell process.
3. You see the result.
4. You write your next command.

If using the text model adapter, every tool use must be a fenced block with a closing fence:

\`\`\`tool=shell
pwd
\`\`\`tool

Submit your changes and finish by issuing this command by itself:
\`echo COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT\``,
    stepLimit: 0,
    costLimit: 0,
    mode: "confirm",
    whitelistActions: [],
    confirmExit: true,
    systemPromptPlacement: "system",
    outputPath: DEFAULT_OUTPUT_PATH
  },
  model: {
    modelClass: "openai",
    modelName: process.env.MINI_NODE_AGENT_MODEL_NAME ?? process.env.OPENAI_MODEL,
    modelKwargs: {},
    observationTemplate:
      "<returncode>{{output.returncode}}</returncode>\n<output>\n{{output.output}}</output>",
    formatErrorTemplate: `Tool call error:

{{error}}

Use one of these formats:

OpenAI tool calling: call the shell tool with {"command":"your command"}.

Text adapter:
\`\`\`tool=shell
your command
\`\`\`tool`
  },
  environment: {
    environmentClass: "local",
    cwd: process.cwd(),
    env: {
      PAGER: "cat",
      MANPAGER: "cat",
      LESS: "-R",
      PIP_PROGRESS_BAR: "off",
      TQDM_DISABLE: "1"
    },
    timeoutMs: 30_000,
    shell: "auto"
  }
};

export function loadConfig(configSpecs: string[] = []): Record<string, unknown> {
  const configs = [DEFAULT_CONFIG];
  for (const spec of configSpecs) {
    configs.push(getConfigFromSpec(spec));
  }
  return recursiveMerge(...configs);
}

export function getConfigFromSpec(spec: string): Record<string, unknown> {
  if (spec.includes("=") && !existsSync(spec)) {
    const [key, ...rest] = spec.split("=");
    return setDottedValue(key, parseScalar(rest.join("=")));
  }
  const path = getConfigPath(spec);
  return (YAML.parse(readFileSync(path, "utf8")) ?? {}) as Record<string, unknown>;
}

export function getConfigPath(spec: string): string {
  const candidates = candidatePaths(spec);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Could not find config file for ${spec} (tried: ${candidates.join(", ")})`);
  }
  return found;
}

function candidatePaths(spec: string): string[] {
  const withSuffix = spec.endsWith(".yaml") || spec.endsWith(".yml") ? spec : `${spec}.yaml`;
  const envDir = process.env.MINI_NODE_AGENT_CONFIG_DIR;
  const raw = isAbsolute(spec) ? [spec] : [resolve(process.cwd(), spec)];
  return [
    ...raw,
    isAbsolute(withSuffix) ? withSuffix : resolve(process.cwd(), withSuffix),
    ...(envDir ? [resolve(envDir, spec), resolve(envDir, withSuffix)] : []),
    join(packageRoot, "config", spec),
    join(packageRoot, "config", withSuffix)
  ];
}
