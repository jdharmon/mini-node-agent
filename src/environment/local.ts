import type { Action, Environment, ExecutionOutput } from "../types.js";
import { createDefaultTools, renderToolList } from "../tools/index.js";
import type { ToolRegistry } from "../tools/index.js";
import type { ShellConfig } from "../tools/shell-runtime.js";

export type { ShellConfig } from "../tools/shell-runtime.js";

export interface LocalEnvironmentConfig {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  shell?: ShellConfig;
  tools?: string[];
}

export class LocalEnvironment implements Environment {
  private readonly config: Required<Omit<LocalEnvironmentConfig, "shell" | "tools">> & { shell: ShellConfig };
  readonly tools: ToolRegistry;

  constructor(config: LocalEnvironmentConfig = {}) {
    this.config = {
      cwd: config.cwd ?? process.cwd(),
      env: config.env ?? {},
      timeoutMs: config.timeoutMs ?? 30_000,
      shell: config.shell ?? "auto"
    };
    this.tools = createDefaultTools({
      shell: this.config.shell,
      env: this.config.env,
      tools: config.tools
    });
  }

  async execute(action: Action, options: { cwd?: string; timeoutMs?: number } = {}): Promise<ExecutionOutput> {
    const tool = this.tools.get(action.tool);
    if (!tool) return { output: "", returncode: -1, exception_info: `Unsupported tool: ${action.tool}` };
    return tool.execute(action, {
      cwd: options.cwd ?? this.config.cwd,
      timeoutMs: options.timeoutMs ?? this.config.timeoutMs
    });
  }

  getTemplateVars(): Record<string, unknown> {
    return {
      cwd: this.config.cwd,
      platform: process.platform,
      arch: process.arch,
      shell: this.config.shell,
      env: process.env,
      tools: renderToolList(this.tools)
    };
  }

  serialize(): Record<string, unknown> {
    return {
      info: {
        config: {
          environment: this.config,
          environmentType: this.constructor.name
        }
      }
    };
  }
}

export function getEnvironment(config: Record<string, unknown>): LocalEnvironment {
  const environmentClass = String(config.environmentClass ?? "local");
  if (environmentClass !== "local") {
    throw new Error(`Unknown environment class: ${environmentClass}`);
  }
  return new LocalEnvironment(config as LocalEnvironmentConfig);
}
