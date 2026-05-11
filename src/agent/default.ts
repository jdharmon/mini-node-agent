import type { AgentConfig, AgentMessage, Environment, ExecutionOutput, Model } from "../types.js";
import { InterruptAgentFlow, LimitsExceeded, Submitted } from "../errors.js";
import { recursiveMerge, renderTemplate, writeJson } from "../utils.js";

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  systemTemplate: "You are a helpful assistant that can interact with a computer.",
  instanceTemplate: "Please solve this issue: {{task}}",
  stepLimit: 0,
  costLimit: 0,
  systemPromptPlacement: "system",
  mode: "confirm",
  whitelistActions: [],
  confirmExit: true
};

export class DefaultAgent {
  readonly config: AgentConfig;
  readonly messages: AgentMessage[] = [];
  protected readonly extraTemplateVars: Record<string, unknown> = {};
  protected cost = 0;
  protected nCalls = 0;

  constructor(
    protected readonly model: Model,
    protected readonly env: Environment,
    config: Partial<AgentConfig> = {}
  ) {
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
  }

  async run(task = "", vars: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    Object.assign(this.extraTemplateVars, { task, ...vars });
    this.messages.length = 0;
    this.addMessages(...this.initialMessages());

    while (true) {
      try {
        await this.step();
      } catch (e) {
        if (e instanceof InterruptAgentFlow) {
          this.addMessages(...e.messages);
        } else {
          const error = e as Error;
          this.addMessages({
            role: "exit",
            content: error.message,
            extra: { exit_status: error.name, submission: "", exception: error.message }
          });
          throw e;
        }
      } finally {
        await this.save(this.config.outputPath);
      }
      if (this.messages.at(-1)?.role === "exit") {
        break;
      }
    }
    return this.messages.at(-1)?.extra ?? {};
  }

  async step(): Promise<AgentMessage[]> {
    return this.executeActions(await this.query());
  }

  async query(): Promise<AgentMessage> {
    if (this.config.stepLimit > 0 && this.nCalls >= this.config.stepLimit) {
      throw new LimitsExceeded({
        role: "exit",
        content: "LimitsExceeded",
        extra: { exit_status: "LimitsExceeded", submission: "" }
      });
    }
    this.nCalls += 1;
    const message = await this.model.query(this.messages);
    this.addMessages(message);
    return message;
  }

  async executeActions(message: AgentMessage): Promise<AgentMessage[]> {
    const actions = (message.extra?.actions ?? []) as Array<{ tool: string; input: string; command?: string }>;
    const outputs: ExecutionOutput[] = [];
    try {
      for (const action of actions) {
        outputs.push(await this.env.execute(action));
      }
    } catch (e) {
      if (e instanceof Submitted) {
        throw e;
      }
      throw e;
    }
    return this.addMessages(...this.model.formatObservationMessages(message, outputs, this.getTemplateVars()));
  }

  addMessages(...messages: AgentMessage[]): AgentMessage[] {
    this.messages.push(...messages);
    return messages;
  }

  getTemplateVars(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return recursiveMerge(
      this.config as unknown as Record<string, unknown>,
      this.env.getTemplateVars(),
      this.model.getTemplateVars(),
      { nModelCalls: this.nCalls, modelCost: this.cost },
      this.extraTemplateVars,
      extra
    );
  }

  serialize(...extra: Record<string, unknown>[]): Record<string, unknown> {
    const lastExtra = this.messages.at(-1)?.extra ?? {};
    return recursiveMerge(
      {
        info: {
          modelStats: {
            instanceCost: this.cost,
            apiCalls: this.nCalls
          },
          config: {
            agent: this.config,
            agentType: this.constructor.name
          },
          exitStatus: lastExtra.exit_status ?? "",
          submission: lastExtra.submission ?? ""
        },
        messages: this.messages,
        trajectoryFormat: "mini-node-agent-0.1"
      },
      this.model.serialize(),
      this.env.serialize(),
      ...extra
    );
  }

  async save(path?: string): Promise<Record<string, unknown>> {
    const data = this.serialize();
    if (path) {
      await writeJson(path, data);
    }
    return data;
  }

  protected initialMessages(): AgentMessage[] {
    const system = renderTemplate(this.config.systemTemplate, this.getTemplateVars());
    const instance = renderTemplate(this.config.instanceTemplate, this.getTemplateVars());
    if (this.config.systemPromptPlacement === "first_user") {
      return [this.model.formatMessage({ role: "user", content: `${system}\n\n${instance}` })];
    }
    return [
      this.model.formatMessage({ role: "system", content: system }),
      this.model.formatMessage({ role: "user", content: instance })
    ];
  }
}
