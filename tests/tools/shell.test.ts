import { describe, expect, it } from "vitest";
import { FormatError } from "../../src/errors.js";
import { ShellTool } from "../../src/tools/shell.js";

const FORMAT = "{{error}}";
const shell = new ShellTool({ executable: "bash", args: ["-lc"] }, {});

describe("ShellTool.parseArgs", () => {
  it("rejects a path argument", () => {
    expect(() => shell.parseArgs({ path: "x", input: "pwd" }, FORMAT)).toThrow(FormatError);
  });

  it("rejects empty input", () => {
    expect(() => shell.parseArgs({ input: "   " }, FORMAT)).toThrow(FormatError);
  });

  it("returns input and command for valid args", () => {
    expect(shell.parseArgs({ input: "echo hi" }, FORMAT)).toEqual({ input: "echo hi", command: "echo hi" });
  });
});

describe("ShellTool.execute", () => {
  it("runs a command and returns stdout", async () => {
    const output = await shell.execute(
      { input: "echo hello", command: "echo hello" },
      { cwd: process.cwd(), timeoutMs: 10_000 }
    );
    expect(output.returncode).toBe(0);
    expect(output.output.trim()).toBe("hello");
  });
});
