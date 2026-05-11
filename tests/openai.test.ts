import { afterEach, describe, expect, it } from "vitest";
import { resolveOpenAIConnection } from "../src/model/openai.js";

const ORIGINAL_ENV = { ...process.env };

describe("OpenAI-compatible connection resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("uses OPENAI_API_KEY for OpenAI models", () => {
    process.env.OPENAI_API_KEY = "openai-key";

    expect(resolveOpenAIConnection({ modelName: "gpt-4.1-mini" })).toEqual({
      apiKey: "openai-key",
      baseURL: undefined
    });
  });

  it("does not infer a base URL for slash-style model names", () => {
    process.env.OPENAI_API_KEY = "openai-compatible-key";

    expect(resolveOpenAIConnection({ modelName: "google/gemma-4-31b-it:free" })).toEqual({
      apiKey: "openai-compatible-key",
      baseURL: undefined
    });
  });

  it("uses explicit base URL config for OpenAI-compatible providers", () => {
    process.env.OPENAI_API_KEY = "openai-key";

    expect(
      resolveOpenAIConnection({
        modelName: "google/gemma-4-31b-it:free",
        apiKey: "explicit-key",
        baseURL: "https://example.test/v1"
      })
    ).toEqual({
      apiKey: "explicit-key",
      baseURL: "https://example.test/v1"
    });
  });
});
