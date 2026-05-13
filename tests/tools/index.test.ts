import { describe, expect, it } from "vitest";
import { createDefaultTools } from "../../src/tools/index.js";

describe("createDefaultTools", () => {
  it("returns all three built-in tools when tools list is omitted", () => {
    const registry = createDefaultTools({ shell: "auto", env: {} });
    expect([...registry.keys()]).toEqual(["shell", "read", "write"]);
  });

  it("filters to only the requested tool when an allowlist is provided", () => {
    const registry = createDefaultTools({ shell: "auto", env: {}, tools: ["shell"] });
    expect([...registry.keys()]).toEqual(["shell"]);
  });

  it("returns all tools when tools is an empty array", () => {
    const registry = createDefaultTools({ shell: "auto", env: {}, tools: [] });
    expect([...registry.keys()]).toEqual(["shell", "read", "write"]);
  });

  it("throws on an unknown tool name in the allowlist", () => {
    expect(() => createDefaultTools({ shell: "auto", env: {}, tools: ["paint"] })).toThrow(
      "Unknown tool 'paint' in environment.tools"
    );
  });
});
