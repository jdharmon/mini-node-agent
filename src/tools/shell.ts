import type { ExecutionOutput } from "../types.js";
import type { Tool, ToolArgs, ToolContext, RawToolMatch } from "./tool.js";
import { makeFormatError } from "./tool.js";
import type { ShellConfig } from "./shell-runtime.js";
import { resolveShell, runProcess } from "./shell-runtime.js";

export class ShellTool implements Tool {
  readonly name = "shell";
  readonly usage = "Run a shell command:\n\n```tool=shell\npwd\n```tool";

  constructor(
    private readonly shellConfig: ShellConfig,
    private readonly env: Record<string, string>
  ) {}

  parseArgs(raw: RawToolMatch, formatErrorTemplate: string): ToolArgs {
    if (raw.path !== undefined) {
      throw makeFormatError("Tool 'shell' does not take an argument.", formatErrorTemplate);
    }
    if (!raw.input.trim()) {
      throw makeFormatError("Missing command input for shell tool block.", formatErrorTemplate);
    }
    return { input: raw.input, command: raw.input };
  }

  async execute(args: ToolArgs, ctx: ToolContext): Promise<ExecutionOutput> {
    const shell = resolveShell(this.shellConfig);
    return runProcess(shell.executable, [...shell.args, args.command ?? args.input], {
      cwd: ctx.cwd,
      timeoutMs: ctx.timeoutMs,
      env: { ...process.env, ...this.env }
    });
  }
}
