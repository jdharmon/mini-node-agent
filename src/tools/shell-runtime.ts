import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExecutionOutput } from "../types.js";
import { Submitted } from "../errors.js";

export type ShellConfig = "auto" | { executable: string; args: string[] };

export function resolveShell(shell: ShellConfig): { executable: string; args: string[] } {
  if (shell !== "auto") return shell;
  if (process.platform === "win32") {
    return {
      executable: findOnPath("pwsh.exe") ?? "powershell.exe",
      args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"]
    };
  }
  return { executable: "bash", args: ["-lc"] };
}

export function runProcess(
  executable: string,
  args: string[],
  options: { cwd: string; timeoutMs: number; env: NodeJS.ProcessEnv }
): Promise<ExecutionOutput> {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true
    });
    let output = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGTERM");
      resolve({
        output,
        returncode: -1,
        exception_info: `Command timed out after ${options.timeoutMs}ms`,
        extra: { exceptionType: "Timeout" }
      });
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        output,
        returncode: -1,
        exception_info: `An error occurred while executing the command: ${error.message}`,
        extra: { exceptionType: error.name, exception: error.message }
      });
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ output, returncode: code ?? -1, exception_info: "" });
    });
  });
}

export function checkFinished(output: ExecutionOutput): void {
  const lines = output.output.trimStart().split(/\r?\n/);
  if (lines[0]?.trim() === "COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT" && output.returncode === 0) {
    const firstLineLength = output.output.indexOf(lines[0]) + lines[0].length;
    const submission = output.output.slice(firstLineLength).replace(/^\r?\n/, "");
    throw new Submitted({
      role: "exit",
      content: submission,
      extra: { exit_status: "Submitted", submission }
    });
  }
}

export function findOnPath(command: string): string | undefined {
  const path = process.env.PATH ?? "";
  const delimiter = process.platform === "win32" ? ";" : ":";
  return path
    .split(delimiter)
    .map((entry) => join(entry, command))
    .find((candidate) => existsSync(candidate));
}
