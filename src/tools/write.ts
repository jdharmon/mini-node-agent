import { writeFileSync } from "node:fs";
import type { ExecutionOutput } from "../types.js";
import type { Tool, ToolArgs, ToolContext, RawToolMatch } from "./tool.js";
import { makeFormatError } from "./tool.js";
import { resolveInsideCwd } from "./path.js";

export class WriteTool implements Tool {
  readonly name = "write";
  readonly usage = `Write a file (body becomes the file contents):\n\n\`\`\`tool=write("path/to/file")\n<file contents>\n\`\`\`tool`;

  parseArgs(raw: RawToolMatch, formatErrorTemplate: string): ToolArgs {
    if (!raw.path) {
      throw makeFormatError("Tool 'write' requires a quoted file path argument.", formatErrorTemplate);
    }
    return { input: raw.input, path: raw.path };
  }

  async execute(args: ToolArgs, ctx: ToolContext): Promise<ExecutionOutput> {
    const r = resolveInsideCwd(args.path, ctx.cwd);
    if (!r.ok) return { output: "", returncode: -1, exception_info: r.error };
    try {
      writeFileSync(r.absolute, args.input, "utf8");
      return { output: "", returncode: 0, exception_info: "" };
    } catch (e) {
      return { output: "", returncode: -1, exception_info: (e as Error).message };
    }
  }
}
