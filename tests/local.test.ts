import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
});
