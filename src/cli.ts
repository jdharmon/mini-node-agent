#!/usr/bin/env node
import { input } from "@inquirer/prompts";
import { Command } from "commander";
import { DEFAULT_OUTPUT_PATH, loadConfig } from "./config.js";
import { InteractiveAgent } from "./agent/interactive.js";
import { getEnvironment } from "./environment/local.js";
import { getModel } from "./model/openai.js";
import { recursiveMerge } from "./utils.js";
import { formatCliError } from "./cli-error.js";
import { readFileSync } from "node:fs";

const program = new Command();

program
  .name("mini-node-agent")
  .description("Run a minimal Node.js software engineering agent.")
  .option("-t, --task <task>", "Task/problem statement")
  .option("-f, --task-file <path>", "File containing the task/problem statement")
  .option("-m, --model <model>", "OpenAI model name")
  .option("--environment <class>", "Environment class", "local")
  .option("-c, --config <spec>", "YAML config file or dotted key=value override", collect, [])
  .option("-y, --yolo", "Run without confirmation")
  .option("-o, --output <path>", "Output trajectory file", DEFAULT_OUTPUT_PATH)
  .option("--exit-immediately", "Exit immediately when the agent wants to finish")
  .option("--system-prompt-placement <placement>", "system or first_user")
  .option("--debug", "Print structured provider errors and stack traces")
  .action(async (options) => {
    const cliConfig = {
      run: {
        task: options.task
      },
      agent: {
        mode: options.yolo ? "yolo" : undefined,
        confirmExit: options.exitImmediately ? false : undefined,
        outputPath: options.output,
        systemPromptPlacement: options.systemPromptPlacement
      },
      model: {
        modelName: options.model
      },
      environment: {
        environmentClass: options.environment
      }
    };

    const config = recursiveMerge(loadConfig(options.config), cliConfig);
    const run = config.run as Record<string, unknown>;
    const agentConfig = config.agent as Record<string, unknown>;
    const modelConfig = config.model as Record<string, unknown>;
    const environmentConfig = config.environment as Record<string, unknown>;

    let task = run.task as string | undefined;
    if (!task && options.taskFile) {
      task = readFileSync(options.taskFile, "utf8");
    }
    if (!task) {
      task = await input({ message: "What do you want to do?" });
    }

    const model = getModel(modelConfig);
    const env = getEnvironment(environmentConfig);
    const agent = new InteractiveAgent(model, env, agentConfig);
    await agent.run(task);
    if (agentConfig.outputPath) {
      console.log(`Saved trajectory to ${agentConfig.outputPath}`);
    }
  });

program.parseAsync().catch((error: unknown) => {
  const debug = Boolean(program.opts<{ debug?: boolean }>().debug);
  console.error(formatCliError(error, debug));
  process.exitCode = 1;
});

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}
