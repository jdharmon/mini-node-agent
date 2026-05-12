import type { Action, AgentMessage, ExecutionOutput } from "../types.js";
import { FormatError } from "../errors.js";
import { renderTemplate } from "../utils.js";

export function parseTextToolActions(content: string, formatErrorTemplate: string): Action[] {
  const regex = /```tool=([A-Za-z0-9_-]+)[^\S\r\n]*\r?\n([\s\S]*?)\r?\n?```tool/g;
  const actions: Action[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const tool = match[1];
    const input = match[2];
    if (tool !== "shell" && tool !== "end") {
      throw formatError(`Unknown tool '${tool}'.`, formatErrorTemplate);
    }
    if (tool === "shell" && !input.trim()) {
      throw formatError("Missing command input for shell tool block.", formatErrorTemplate);
    }
    actions.push(tool === "shell" ? { tool, input, command: input } : { tool, input });
  }

  if (actions.length === 0) {
    const message = content.includes("```tool=")
      ? "Malformed tool block. Use a fenced block with a closing ```tool fence."
      : "No tool blocks found in the response. Every response must include at least one tool block.";
    throw formatError(message, formatErrorTemplate);
  }
  return actions;
}

export function formatObservationMessages(
  actions: Action[],
  outputs: ExecutionOutput[],
  observationTemplate: string,
  templateVars: Record<string, unknown> = {}
): AgentMessage[] {
  const notExecuted: ExecutionOutput = {
    output: "",
    returncode: -1,
    exception_info: "action was not executed"
  };

  return actions.map((_action, index) => {
    const output = outputs[index] ?? notExecuted;
    const content = renderTemplate(observationTemplate, { ...templateVars, output });
    return {
      role: "user",
      content,
      extra: {
        raw_output: output.output,
        returncode: output.returncode,
        exception_info: output.exception_info,
        timestamp: Date.now() / 1000,
        ...(output.extra ?? {})
      }
    };
  });
}

function formatError(error: string, template: string): FormatError {
  return new FormatError({
    role: "user",
    content: renderTemplate(template, { error }),
    extra: { interrupt_type: "FormatError" }
  });
}
