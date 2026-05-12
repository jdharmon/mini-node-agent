import type { Action, AgentMessage, ExecutionOutput } from "../types.js";
import { FormatError } from "../errors.js";
import { renderTemplate } from "../utils.js";

export const SHELL_TOOL = {
  type: "function",
  function: {
    name: "shell",
    description: "Execute a shell command",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute"
        }
      },
      required: ["command"]
    }
  }
} as const;

export function parseToolCallActions(toolCalls: unknown, formatErrorTemplate: string): Action[] {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    throw formatError("No tool calls found in the response. Every response must include at least one tool call.", formatErrorTemplate);
  }

  return toolCalls.map((toolCall) => {
    const call = toolCall as {
      id?: string;
      function?: { name?: string; arguments?: string };
    };
    let args: unknown;
    let error = "";
    try {
      args = JSON.parse(call.function?.arguments ?? "");
    } catch (e) {
      error += `Error parsing tool call arguments: ${String(e)}. `;
      args = {};
    }
    if (call.function?.name !== "shell") {
      error += `Unknown tool '${call.function?.name ?? ""}'. `;
    }
    const command = isCommandArgs(args) ? args.command : undefined;
    if (command === undefined) {
      error += "Missing 'command' argument in shell tool call.";
    }
    if (error) {
      throw formatError(error.trim(), formatErrorTemplate);
    }
    const finalCommand = command as string;
    return {
      tool: "shell",
      input: finalCommand,
      command: finalCommand,
      toolCallId: call.id
    };
  });
}

export function parseTextToolActions(content: string, formatErrorTemplate: string): Action[] {
  const regex = /```tool=([A-Za-z0-9_-]+)[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```tool/g;
  const actions: Action[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const tool = match[1];
    const input = match[2];
    if (tool !== "shell") {
      throw formatError(`Unknown tool '${tool}'.`, formatErrorTemplate);
    }
    if (!input.trim()) {
      throw formatError("Missing command input for shell tool block.", formatErrorTemplate);
    }
    actions.push({ tool, input, command: input });
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

  return actions.map((action, index) => {
    const output = outputs[index] ?? notExecuted;
    const content = renderTemplate(observationTemplate, { ...templateVars, output });
    const message: AgentMessage = {
      role: action.toolCallId ? "tool" : "user",
      content,
      extra: {
        raw_output: output.output,
        returncode: output.returncode,
        exception_info: output.exception_info,
        timestamp: Date.now() / 1000,
        ...(output.extra ?? {})
      }
    };
    if (action.toolCallId) {
      message.tool_call_id = action.toolCallId;
    }
    return message;
  });
}

function isCommandArgs(value: unknown): value is { command: string } {
  return typeof value === "object" && value !== null && typeof (value as { command?: unknown }).command === "string";
}

function formatError(error: string, template: string): FormatError {
  return new FormatError({
    role: "user",
    content: renderTemplate(template, { error }),
    extra: { interrupt_type: "FormatError" }
  });
}
