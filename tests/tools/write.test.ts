import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FormatError } from "../../src/errors.js";
import { WriteTool } from "../../src/tools/write.js";

const FORMAT = "{{error}}";
const write = new WriteTool();

describe("WriteTool.parseArgs", () => {
  it("rejects missing path", () => {
    expect(() => write.parseArgs({ input: "content" }, FORMAT)).toThrow(FormatError);
  });

  it("returns path and input for valid args", () => {
    expect(write.parseArgs({ path: "out.txt", input: "contents" }, FORMAT)).toEqual({
      input: "contents",
      path: "out.txt"
    });
  });
});

describe("WriteTool.execute", () => {
  it("writes a file inside the working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "mini-node-agent-"));
    try {
      const output = await write.execute({ input: "hello\n", path: "out.txt" }, { cwd, timeoutMs: 5_000 });
      expect(output.returncode).toBe(0);
      expect(await readFile(join(cwd, "out.txt"), "utf8")).toBe("hello\n");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("returns an error for a path outside the working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "mini-node-agent-"));
    try {
      const output = await write.execute({ input: "x", path: "../escape.txt" }, { cwd, timeoutMs: 5_000 });
      expect(output.returncode).toBe(-1);
      expect(output.exception_info).toMatch(/outside the working directory/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
