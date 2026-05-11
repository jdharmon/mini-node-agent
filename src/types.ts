export type MessageRole = "system" | "user" | "assistant" | "tool" | "exit";

export type AgentMode = "human" | "confirm" | "yolo";

export type SystemPromptPlacement = "system" | "first_user";

export interface AgentMessage {
  role: MessageRole | string;
  content?: string | null;
  tool_calls?: unknown[];
  tool_call_id?: string;
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Action {
  tool: string;
  input: string;
  command?: string;
  toolCallId?: string;
}

export interface ExecutionOutput {
  output: string;
  returncode: number;
  exception_info: string;
  extra?: Record<string, unknown>;
}

export interface Model {
  query(messages: AgentMessage[]): Promise<AgentMessage>;
  formatMessage(message: AgentMessage): AgentMessage;
  formatObservationMessages(
    message: AgentMessage,
    outputs: ExecutionOutput[],
    templateVars?: Record<string, unknown>
  ): AgentMessage[];
  getTemplateVars(): Record<string, unknown>;
  serialize(): Record<string, unknown>;
}

export interface Environment {
  execute(action: Action, options?: { cwd?: string; timeoutMs?: number }): Promise<ExecutionOutput>;
  getTemplateVars(): Record<string, unknown>;
  serialize(): Record<string, unknown>;
}

export interface AgentConfig {
  systemTemplate: string;
  instanceTemplate: string;
  stepLimit: number;
  costLimit: number;
  outputPath?: string;
  mode?: AgentMode;
  whitelistActions?: string[];
  confirmExit?: boolean;
  systemPromptPlacement: SystemPromptPlacement;
}
