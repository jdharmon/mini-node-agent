import type { AgentMessage } from "./types.js";

export class InterruptAgentFlow extends Error {
  constructor(public readonly messages: AgentMessage[]) {
    super("InterruptAgentFlow");
  }
}

export class FormatError extends InterruptAgentFlow {
  constructor(message: AgentMessage) {
    super([message]);
    this.name = "FormatError";
  }
}

export class LimitsExceeded extends InterruptAgentFlow {
  constructor(message: AgentMessage) {
    super([message]);
    this.name = "LimitsExceeded";
  }
}

export class Submitted extends InterruptAgentFlow {
  constructor(message: AgentMessage) {
    super([message]);
    this.name = "Submitted";
  }
}
