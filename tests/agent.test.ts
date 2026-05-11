import { describe, expect, it } from "vitest";
import { DefaultAgent } from "../src/agent/default.js";
import type { AgentMessage, Environment, ExecutionOutput, Model } from "../src/types.js";

class FakeModel implements Model {
  calls = 0;

  async query(): Promise<AgentMessage> {
    this.calls += 1;
    return {
      role: "assistant",
      content: "run command",
      extra: {
        actions: [{ tool: "shell", input: "echo ok", command: "echo ok" }]
      }
    };
  }

  formatMessage(message: AgentMessage): AgentMessage {
    return message;
  }

  formatObservationMessages(_message: AgentMessage, outputs: ExecutionOutput[]): AgentMessage[] {
    return [{ role: "exit", content: outputs[0].output, extra: { exit_status: "Submitted", submission: outputs[0].output } }];
  }

  getTemplateVars(): Record<string, unknown> {
    return {};
  }

  serialize(): Record<string, unknown> {
    return {};
  }
}

class FakeEnvironment implements Environment {
  async execute(): Promise<ExecutionOutput> {
    return { output: "ok\n", returncode: 0, exception_info: "" };
  }

  getTemplateVars(): Record<string, unknown> {
    return {};
  }

  serialize(): Record<string, unknown> {
    return {};
  }
}

describe("DefaultAgent", () => {
  it("runs a model action and records the exit message", async () => {
    const model = new FakeModel();
    const agent = new DefaultAgent(model, new FakeEnvironment(), {
      systemTemplate: "system",
      instanceTemplate: "task {{task}}",
      systemPromptPlacement: "system",
      stepLimit: 0,
      costLimit: 0
    });

    const result = await agent.run("demo");

    expect(model.calls).toBe(1);
    expect(result.submission).toBe("ok\n");
    expect(agent.messages[0].role).toBe("system");
    expect(agent.messages[1].content).toBe("task demo");
  });

  it("can inject the system prompt into the first user message", async () => {
    const agent = new DefaultAgent(new FakeModel(), new FakeEnvironment(), {
      systemTemplate: "system",
      instanceTemplate: "task {{task}}",
      systemPromptPlacement: "first_user",
      stepLimit: 0,
      costLimit: 0
    });

    await agent.run("demo");

    expect(agent.messages[0].role).toBe("user");
    expect(agent.messages[0].content).toBe("system\n\ntask demo");
  });
});
