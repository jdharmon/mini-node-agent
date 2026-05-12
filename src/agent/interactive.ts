import { input } from "@inquirer/prompts";
import type { AgentConfig, AgentMessage, Environment, ExecutionOutput, Model } from "../types.js";
import { InterruptAgentFlow, Submitted } from "../errors.js";
import { DefaultAgent } from "./default.js";

export class InteractiveAgent extends DefaultAgent {
  constructor(model: Model, env: Environment, config: Partial<AgentConfig> = {}) {
    super(model, env, config);
  }

  override async query(): Promise<AgentMessage> {
    if (this.config.mode === "human") {
      const command = await input({ message: ">" });
      const message: AgentMessage = {
        role: "user",
        content: `User command:\n\`\`\`tool=shell\n${command}\n\`\`\`tool`,
        extra: { actions: [{ tool: "shell", input: command, command }] }
      };
      this.addMessages(message);
      return message;
    }
    const message = await super.query();
    
    // Format the message content for console display
    if (message.content) {
      const displayContent = message.content.replace(/```tool=([^\r\n]+)\r?\n([\s\S]*?)```tool/g, (match, toolHeader, body) => {
        const header = toolHeader.trim();
        if (header === "end") {
          return ""
        } else if (header === "shell") {
          return `TOOL: ${body.trim()}`;
        } else {
          return `TOOL: ${header}`;
        }
      });
      
      console.log(`\n${displayContent}\n`);
    }
    
    return message;
  }

  override async executeActions(message: AgentMessage): Promise<AgentMessage[]> {
    const actions = (message.extra?.actions ?? []) as Array<{ tool: string; input: string; command?: string }>;
    await this.confirmActions(actions);
    const outputs: ExecutionOutput[] = [];
    try {
      for (const action of actions) {
        if (action.tool === "end") {
          throw new Submitted({ role: "exit", content: "", extra: { exit_status: "Submitted", submission: "" } });
        }
        outputs.push(await this.env.execute(action));
      }
    } catch (e) {
      if (e instanceof Submitted) {
        if (this.config.confirmExit) {
          const nextTask = await input({
            message: "Agent wants to finish. Press Enter to quit, or type a new task"
          });
          if (nextTask.trim()) {
            this.addMessages({ role: "user", content: `The user added a new task: ${nextTask}` });
            return [];
          }
        }
        throw e;
      }
      throw e;
    }
    return this.addMessages(...this.model.formatObservationMessages(message, outputs, this.getTemplateVars()));
  }

  private async confirmActions(actions: Array<{ tool: string; command?: string; input: string }>): Promise<void> {
    if (this.config.mode !== "confirm") return;
    const whitelist = this.config.whitelistActions ?? [];
    const commands = actions
      .filter((action) => action.tool !== "end")
      .map((action) => action.command ?? action.input);
    if (commands.every((command) => whitelist.some((pattern) => new RegExp(pattern).test(command)))) {
      return;
    }
    const answer = await input({
      message: `Execute ${commands.length} action(s)? Press Enter to confirm, or type a rejection`
    });
    if (answer.trim()) {
      throw new InterruptAgentFlow([
        {
          role: "user",
          content: `Commands not executed. The user rejected your commands with: ${answer}`,
          extra: { interrupt_type: "UserRejection" }
        }
      ]);
    }
  }
}
