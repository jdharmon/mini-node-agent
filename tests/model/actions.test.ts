import { describe, expect, it } from "vitest";
import { FormatError } from "../../src/errors.js";
import { parseTextToolActions } from "../../src/model/actions.js";

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

  it("parses tool=read with a quoted path and ignores the body", () => {
    const actions = parseTextToolActions("```tool=read(\"foo.ts\")\n```tool", FORMAT);
    expect(actions).toEqual([{ tool: "read", input: "", path: "foo.ts" }]);
  });

  it("parses tool=write with a quoted path and a multi-line body", () => {
    const actions = parseTextToolActions("```tool=write(\"dir/out.txt\")\nline one\nline two\n```tool", FORMAT);
    expect(actions).toEqual([{ tool: "write", input: "line one\nline two", path: "dir/out.txt" }]);
  });

  it("rejects tool=read without a path argument", () => {
    expect(() => parseTextToolActions("```tool=read\n```tool", FORMAT)).toThrow(FormatError);
    expect(formatErrorContent("```tool=read\n```tool")).toMatch(/requires a quoted file path/);
  });

  it("rejects tool=write without a path argument", () => {
    expect(() => parseTextToolActions("```tool=write\nx\n```tool", FORMAT)).toThrow(FormatError);
    expect(formatErrorContent("```tool=write\nx\n```tool")).toMatch(/requires a quoted file path/);
  });

  it("rejects tool=shell with an argument", () => {
    expect(() => parseTextToolActions("```tool=shell(\"x\")\npwd\n```tool", FORMAT)).toThrow(FormatError);
    expect(formatErrorContent("```tool=shell(\"x\")\npwd\n```tool")).toMatch(/does not take an argument/);
  });
});

function formatErrorContent(content: string): string {
  try {
    parseTextToolActions(content, FORMAT);
    throw new Error("expected parseTextToolActions to throw");
  } catch (e) {
    if (e instanceof FormatError) return String(e.messages[0]?.content ?? "");
    throw e;
  }
}
