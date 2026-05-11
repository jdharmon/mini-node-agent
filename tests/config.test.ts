import { describe, expect, it } from "vitest";
import { getConfigFromSpec, loadConfig } from "../src/config.js";

describe("config", () => {
  it("loads dotted key-value overrides", () => {
    expect(getConfigFromSpec("agent.mode=yolo")).toEqual({ agent: { mode: "yolo" } });
    expect(getConfigFromSpec("environment.timeoutMs=1000")).toEqual({ environment: { timeoutMs: 1000 } });
  });

  it("merges overrides into defaults", () => {
    const config = loadConfig(["agent.mode=yolo", "model.modelName=\"gpt-test\""]);
    expect((config.agent as Record<string, unknown>).mode).toBe("yolo");
    expect((config.model as Record<string, unknown>).modelName).toBe("gpt-test");
  });
});
