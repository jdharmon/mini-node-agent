import { describe, expect, it } from "vitest";
import { FormatError } from "../src/errors.js";
import { parseTextToolActions, parseToolCallActions, SHELL_TOOL } from "../src/model/actions.js";

const FORMAT = "{{error}}";

describe("tool actions", () => {
  it("defines a shell tool", () => {
    expect(SHELL_TOOL.function.name).toBe("shell");
    expect(SHELL_TOOL.function.parameters.required).toEqual(["command"]);
  });

  it("parses text shell blocks with closing fences", () => {
    const actions = parseTextToolActions("Thinking\n```tool=shell\npwd\n```", FORMAT);
    expect(actions).toEqual([{ tool: "shell", input: "pwd", command: "pwd" }]);
  });

  it("parses multiple text shell blocks", () => {
    const actions = parseTextToolActions("```tool=shell\npwd\n```\n```tool=shell\necho hi\n```", FORMAT);
    expect(actions.map((action) => action.command)).toEqual(["pwd", "echo hi"]);
  });

  it("rejects missing closing fences", () => {
    expect(() => parseTextToolActions("```tool=shell\npwd", FORMAT)).toThrow(FormatError);
  });

  it("rejects unknown text tools", () => {
    expect(() => parseTextToolActions("```tool=edit\nx\n```", FORMAT)).toThrow("InterruptAgentFlow");
  });

  it("parses OpenAI-style tool calls", () => {
    const actions = parseToolCallActions(
      [
        {
          id: "call_1",
          function: { name: "shell", arguments: JSON.stringify({ command: "pwd" }) }
        }
      ],
      FORMAT
    );
    expect(actions).toEqual([{ tool: "shell", input: "pwd", command: "pwd", toolCallId: "call_1" }]);
  });
});
