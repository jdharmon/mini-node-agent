import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FormatError } from "../../src/errors.js";
import { ReadTool } from "../../src/tools/read.js";

const FORMAT = "{{error}}";
const read = new ReadTool();

describe("ReadTool.parseArgs", () => {
  it("rejects missing path", () => {
    expect(() => read.parseArgs({ input: "" }, FORMAT)).toThrow(FormatError);
  });

  it("returns path and empty input for valid args", () => {
    expect(read.parseArgs({ path: "foo.txt", input: "ignored" }, FORMAT)).toEqual({
      input: "",
      path: "foo.txt"
    });
  });
});

describe("ReadTool.execute", () => {
  it("reads a file inside the working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "mini-node-agent-"));
    try {
      await writeFile(join(cwd, "test.txt"), "hello", "utf8");
      const output = await read.execute({ input: "", path: "test.txt" }, { cwd, timeoutMs: 5_000 });
      expect(output.returncode).toBe(0);
      expect(output.output).toBe("hello");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("returns an error for a path outside the working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "mini-node-agent-"));
    try {
      const output = await read.execute({ input: "", path: "/etc/hosts" }, { cwd, timeoutMs: 5_000 });
      expect(output.returncode).toBe(-1);
      expect(output.exception_info).toMatch(/outside the working directory/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
