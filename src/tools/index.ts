import type { ShellConfig } from "./shell-runtime.js";
import type { Tool, ToolRegistry } from "./tool.js";
import { ShellTool } from "./shell.js";
import { ReadTool } from "./read.js";
import { WriteTool } from "./write.js";

export { renderToolList } from "./tool.js";
export type { Tool, ToolArgs, ToolContext, RawToolMatch, ToolRegistry } from "./tool.js";

export interface CreateDefaultToolsConfig {
  shell: ShellConfig;
  env: Record<string, string>;
  tools?: string[];
}

export function createDefaultTools(cfg: CreateDefaultToolsConfig): ToolRegistry {
  const all: ToolRegistry = new Map<string, Tool>([
    ["shell", new ShellTool(cfg.shell, cfg.env)],
    ["read", new ReadTool()],
    ["write", new WriteTool()]
  ]);

  if (!cfg.tools || cfg.tools.length === 0) return all;

  const filtered: ToolRegistry = new Map();
  for (const name of cfg.tools) {
    const tool = all.get(name);
    if (!tool) throw new Error(`Unknown tool '${name}' in environment.tools`);
    filtered.set(name, tool);
  }
  return filtered;
}
