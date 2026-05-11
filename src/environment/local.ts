import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Action, Environment, ExecutionOutput } from "../types.js";
import { Submitted } from "../errors.js";

export type ShellConfig = "auto" | { executable: string; args: string[] };

export interface LocalEnvironmentConfig {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  shell?: ShellConfig;
}

export class LocalEnvironment implements Environment {
  private readonly config: Required<Omit<LocalEnvironmentConfig, "shell">> & { shell: ShellConfig };

  constructor(config: LocalEnvironmentConfig = {}) {
    this.config = {
      cwd: config.cwd ?? process.cwd(),
      env: config.env ?? {},
      timeoutMs: config.timeoutMs ?? 30_000,
      shell: config.shell ?? "auto"
    };
  }

  async execute(action: Action, options: { cwd?: string; timeoutMs?: number } = {}): Promise<ExecutionOutput> {
    if (action.tool !== "shell") {
      return {
        output: "",
        returncode: -1,
        exception_info: `Unsupported tool: ${action.tool}`
      };
    }
    const shell = this.resolveShell();
    const output = await this.runProcess(shell.executable, [...shell.args, action.command ?? action.input], {
      cwd: options.cwd ?? this.config.cwd,
      timeoutMs: options.timeoutMs ?? this.config.timeoutMs
    });
    this.checkFinished(output);
    return output;
  }

  getTemplateVars(): Record<string, unknown> {
    return {
      cwd: this.config.cwd,
      platform: process.platform,
      arch: process.arch,
      shell: this.config.shell,
      env: process.env
    };
  }

  serialize(): Record<string, unknown> {
    return {
      info: {
        config: {
          environment: this.config,
          environmentType: this.constructor.name
        }
      }
    };
  }

  private resolveShell(): { executable: string; args: string[] } {
    if (this.config.shell !== "auto") {
      return this.config.shell;
    }
    if (process.platform === "win32") {
      return { executable: findOnPath("pwsh.exe") ?? "powershell.exe", args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"] };
    }
    return { executable: "bash", args: ["-lc"] };
  }

  private runProcess(
    executable: string,
    args: string[],
    options: { cwd: string; timeoutMs: number }
  ): Promise<ExecutionOutput> {
    return new Promise((resolve) => {
      const child = spawn(executable, args, {
        cwd: options.cwd,
        env: { ...process.env, ...this.config.env },
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
        resolve({
          output,
          returncode: code ?? -1,
          exception_info: ""
        });
      });
    });
  }

  private checkFinished(output: ExecutionOutput): void {
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
}

function findOnPath(command: string): string | undefined {
  const path = process.env.PATH ?? "";
  const delimiter = process.platform === "win32" ? ";" : ":";
  return path.split(delimiter).map((entry) => join(entry, command)).find((candidate) => existsSync(candidate));
}

export function getEnvironment(config: Record<string, unknown>): Environment {
  const environmentClass = String(config.environmentClass ?? "local");
  if (environmentClass !== "local") {
    throw new Error(`Unknown environment class: ${environmentClass}`);
  }
  return new LocalEnvironment(config as LocalEnvironmentConfig);
}
