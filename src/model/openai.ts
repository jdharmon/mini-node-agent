import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { AgentMessage, ExecutionOutput, Model } from "../types.js";
import { formatObservationMessages, parseTextToolActions, parseToolCallActions, SHELL_TOOL } from "./actions.js";

export interface OpenAIModelConfig {
  modelName: string;
  modelKwargs?: Record<string, unknown>;
  observationTemplate?: string;
  formatErrorTemplate?: string;
  apiKey?: string;
  baseURL?: string;
}

const DEFAULT_OBSERVATION_TEMPLATE =
  "<returncode>{{output.returncode}}</returncode>\n<output>\n{{output.output}}</output>";

const DEFAULT_FORMAT_ERROR_TEMPLATE = "Tool call error:\n\n{{error}}\n\nUse the shell tool with a command.";

export class OpenAIToolModel implements Model {
  protected readonly client: OpenAI;
  protected readonly config: Required<Omit<OpenAIModelConfig, "apiKey" | "baseURL">> & Pick<OpenAIModelConfig, "apiKey" | "baseURL">;

  constructor(config: OpenAIModelConfig) {
    this.config = {
      modelName: config.modelName,
      modelKwargs: config.modelKwargs ?? {},
      observationTemplate: config.observationTemplate ?? DEFAULT_OBSERVATION_TEMPLATE,
      formatErrorTemplate: config.formatErrorTemplate ?? DEFAULT_FORMAT_ERROR_TEMPLATE,
      apiKey: config.apiKey,
      baseURL: config.baseURL
    };
    this.client = new OpenAI({
      apiKey: this.config.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: this.config.baseURL
    });
  }

  async query(messages: AgentMessage[]): Promise<AgentMessage> {
    const response = await this.client.chat.completions.create({
      model: this.config.modelName,
      messages: this.prepareMessages(messages),
      tools: [SHELL_TOOL],
      ...(this.config.modelKwargs as object)
    });
    const rawMessage = response.choices[0]?.message;
    const message: AgentMessage = {
      ...(rawMessage as unknown as Record<string, unknown>),
      role: "assistant",
      content: rawMessage?.content ?? null,
      extra: {
        actions: parseToolCallActions(rawMessage?.tool_calls ?? [], this.config.formatErrorTemplate),
        response,
        usage: response.usage,
        timestamp: Date.now() / 1000
      }
    };
    return message;
  }

  formatMessage(message: AgentMessage): AgentMessage {
    return message;
  }

  formatObservationMessages(
    message: AgentMessage,
    outputs: ExecutionOutput[],
    templateVars: Record<string, unknown> = {}
  ): AgentMessage[] {
    const actions = (message.extra?.actions ?? []) as Parameters<typeof formatObservationMessages>[0];
    return formatObservationMessages(actions, outputs, this.config.observationTemplate, templateVars);
  }

  getTemplateVars(): Record<string, unknown> {
    return {
      modelName: this.config.modelName,
      modelKwargs: this.config.modelKwargs
    };
  }

  serialize(): Record<string, unknown> {
    return {
      info: {
        config: {
          model: {
            modelName: this.config.modelName,
            modelKwargs: this.config.modelKwargs,
            observationTemplate: this.config.observationTemplate,
            formatErrorTemplate: this.config.formatErrorTemplate
          },
          modelType: this.constructor.name
        }
      }
    };
  }

  protected prepareMessages(messages: AgentMessage[]): ChatCompletionMessageParam[] {
    return messages
      .filter((message) => message.role !== "exit")
      .map((message) => {
        const { extra: _extra, ...rest } = message;
        return rest as unknown as ChatCompletionMessageParam;
      });
  }
}

export class OpenAITextModel extends OpenAIToolModel {
  async query(messages: AgentMessage[]): Promise<AgentMessage> {
    const response = await this.client.chat.completions.create({
      model: this.config.modelName,
      messages: this.prepareMessages(messages),
      ...(this.config.modelKwargs as object)
    });
    const rawMessage = response.choices[0]?.message;
    const content = rawMessage?.content ?? "";
    return {
      ...(rawMessage as unknown as Record<string, unknown>),
      role: "assistant",
      content,
      extra: {
        actions: parseTextToolActions(content, this.config.formatErrorTemplate),
        response,
        usage: response.usage,
        timestamp: Date.now() / 1000
      }
    };
  }
}

export function getModel(config: Record<string, unknown>): Model {
  const modelClass = String(config.modelClass ?? "openai");
  const modelName = String(config.modelName ?? process.env.NODE_AGENT_MODEL_NAME ?? process.env.OPENAI_MODEL ?? "");
  if (!modelName) {
    throw new Error("No model configured. Pass --model or set NODE_AGENT_MODEL_NAME.");
  }
  const modelConfig = {
    modelName,
    modelKwargs: (config.modelKwargs as Record<string, unknown> | undefined) ?? {},
    observationTemplate: String(config.observationTemplate ?? DEFAULT_OBSERVATION_TEMPLATE),
    formatErrorTemplate: String(config.formatErrorTemplate ?? DEFAULT_FORMAT_ERROR_TEMPLATE),
    apiKey: config.apiKey as string | undefined,
    baseURL: config.baseURL as string | undefined
  };
  if (modelClass === "openai_text") {
    return new OpenAITextModel(modelConfig);
  }
  if (modelClass === "openai") {
    return new OpenAIToolModel(modelConfig);
  }
  throw new Error(`Unknown model class: ${modelClass}`);
}
