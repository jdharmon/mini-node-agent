import { FormatError } from "../errors.js";
import { renderTemplate } from "../utils.js";
import type { ExecutionOutput } from "../types.js";

export interface ToolContext {
  cwd: string;
  timeoutMs: number;
}

export interface RawToolMatch {
  path?: string;
  input: string;
}

export interface ToolArgs {
  input: string;
  path?: string;
  command?: string;
}

export interface Tool {
  readonly name: string;
  readonly usage: string;
  parseArgs(raw: RawToolMatch, formatErrorTemplate: string): ToolArgs;
  execute(args: ToolArgs, ctx: ToolContext): Promise<ExecutionOutput>;
}

export type ToolRegistry = Map<string, Tool>;

export function renderToolList(tools: ToolRegistry): string {
  return [...tools.values()].map((t) => t.usage).join("\n\n");
}

export function makeFormatError(error: string, template: string): FormatError {
  return new FormatError({
    role: "user",
    content: renderTemplate(template, { error }),
    extra: { interrupt_type: "FormatError" }
  });
}
