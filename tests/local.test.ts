import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Submitted } from "../src/errors.js";
import { LocalEnvironment } from "../src/environment/local.js";

describe("LocalEnvironment", () => {
  it("executes shell commands", async () => {
    const env = new LocalEnvironment({ shell: { executable: "bash", args: ["-lc"] } });
    const output = await env.execute({ tool: "shell", input: "echo hello", command: "echo hello" });
    expect(output.returncode).toBe(0);
    expect(output.output).toBe("hello\n");
  });

  it("persists filesystem edits across fresh shell processes", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "mini-node-agent-"));
    try {
      const env = new LocalEnvironment({ cwd, shell: { executable: "bash", args: ["-lc"] } });
      await env.execute({ tool: "shell", input: "printf hi > file.txt", command: "printf hi > file.txt" });
      expect(await readFile(join(cwd, "file.txt"), "utf8")).toBe("hi");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("raises Submitted on the completion marker", async () => {
    const env = new LocalEnvironment({ shell: { executable: "bash", args: ["-lc"] } });
    await expect(
      env.execute({
        tool: "shell",
        input: "printf 'COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT\\ndone\\n'",
        command: "printf 'COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT\\ndone\\n'"
      })
    ).rejects.toBeInstanceOf(Submitted);
  });

  it("reads a file inside the working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "mini-node-agent-"));
    try {
      await writeFile(join(cwd, "hello.txt"), "hi there", "utf8");
      const env = new LocalEnvironment({ cwd });
      const output = await env.execute({ tool: "read", input: "", path: "hello.txt" });
      expect(output.returncode).toBe(0);
      expect(output.output).toBe("hi there");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("writes a file inside the working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "mini-node-agent-"));
    try {
      const env = new LocalEnvironment({ cwd });
      const write = await env.execute({ tool: "write", input: "new content\n", path: "out.txt" });
      expect(write.returncode).toBe(0);
      expect(write.output).toBe("");
      expect(await readFile(join(cwd, "out.txt"), "utf8")).toBe("new content\n");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("rejects reads with an absolute path outside the working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "mini-node-agent-"));
    try {
      const env = new LocalEnvironment({ cwd });
      const output = await env.execute({ tool: "read", input: "", path: "/etc/hosts" });
      expect(output.returncode).toBe(-1);
      expect(output.exception_info).toMatch(/outside the working directory/);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("rejects writes that traverse out of the working directory", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "mini-node-agent-"));
    try {
      const env = new LocalEnvironment({ cwd });
      const output = await env.execute({ tool: "write", input: "x", path: "../escape.txt" });
      expect(output.returncode).toBe(-1);
      expect(output.exception_info).toMatch(/outside the working directory/);
      expect(existsSync(join(cwd, "..", "escape.txt"))).toBe(false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
