import { describe, expect, it } from "vitest";
import { formatCliError } from "../src/cli-error.js";

describe("formatCliError", () => {
  it("prints structured provider fields", () => {
    const error = Object.assign(new Error("429 Provider returned error"), {
      status: 429,
      code: "rate_limit_exceeded",
      request_id: "req_123",
      headers: {
        "retry-after": "10",
        "x-ratelimit-remaining": "0"
      }
    });

    const message = formatCliError(error);

    expect(message).toContain("429 Provider returned error");
    expect(message).toContain("status: 429");
    expect(message).toContain("code: rate_limit_exceeded");
    expect(message).toContain("request_id: req_123");
    expect(message).toContain("retry-after: 10");
  });

  it("prints provider metadata in debug mode", () => {
    const error = Object.assign(new Error("Provider returned error"), {
      error: {
        message: "upstream rate limited",
        metadata: { provider_name: "Google AI Studio" }
      }
    });

    const message = formatCliError(error, true);

    expect(message).toContain("provider_error:");
    expect(message).toContain("Google AI Studio");
  });
});
