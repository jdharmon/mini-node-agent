import { describe, expect, it } from "vitest";
import { FormatError } from "../src/errors.js";
import { parseTextToolActions } from "../src/model/actions.js";

const FORMAT = "{{error}}";

describe("tool actions", () => {
  it("parses text shell blocks with closing fences", () => {
    const actions = parseTextToolActions("Thinking\n```tool=shell\npwd\n```tool", FORMAT);
    expect(actions).toEqual([{ tool: "shell", input: "pwd", command: "pwd" }]);
  });

  it("parses multiple text shell blocks", () => {
    const actions = parseTextToolActions("```tool=shell\npwd\n```tool\n```tool=shell\necho hi\n```tool", FORMAT);
    expect(actions.map((action) => action.command)).toEqual(["pwd", "echo hi"]);
  });

  it("rejects missing closing fences", () => {
    expect(() => parseTextToolActions("```tool=shell\npwd", FORMAT)).toThrow(FormatError);
  });

  it("rejects unknown text tools", () => {
    expect(() => parseTextToolActions("```tool=edit\nx\n```tool", FORMAT)).toThrow("InterruptAgentFlow");
  });

  it("parses a tool=end block with empty body", () => {
    const actions = parseTextToolActions("```tool=end\n```tool", FORMAT);
    expect(actions).toEqual([{ tool: "end", input: "" }]);
  });

  it("parses tool=end after tool=shell in the same response", () => {
    const actions = parseTextToolActions("```tool=shell\npwd\n```tool\n```tool=end\n```tool", FORMAT);
    expect(actions).toEqual([
      { tool: "shell", input: "pwd", command: "pwd" },
      { tool: "end", input: "" }
    ]);
  });
});
