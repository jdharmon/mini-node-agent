import { readFileSync } from "node:fs";
import type { ExecutionOutput } from "../types.js";
import type { Tool, ToolArgs, ToolContext, RawToolMatch } from "./tool.js";
import { makeFormatError } from "./tool.js";
import { resolveInsideCwd } from "./path.js";

export class ReadTool implements Tool {
  readonly name = "read";
  readonly usage = `Read a file (body ignored):\n\n\`\`\`tool=read("path/to/file")\n\`\`\`tool`;

  parseArgs(raw: RawToolMatch, formatErrorTemplate: string): ToolArgs {
    if (!raw.path) {
      throw makeFormatError("Tool 'read' requires a quoted file path argument.", formatErrorTemplate);
    }
    return { input: "", path: raw.path };
  }

  async execute(args: ToolArgs, ctx: ToolContext): Promise<ExecutionOutput> {
    const r = resolveInsideCwd(args.path, ctx.cwd);
    if (!r.ok) return { output: "", returncode: -1, exception_info: r.error };
    try {
      return { output: readFileSync(r.absolute, "utf8"), returncode: 0, exception_info: "" };
    } catch (e) {
      return { output: "", returncode: -1, exception_info: (e as Error).message };
    }
  }
}
