export function formatCliError(error: unknown, debug = false): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const record = error as Error & {
    status?: number;
    code?: string;
    type?: string;
    param?: string;
    request_id?: string;
    requestID?: string;
    headers?: Record<string, unknown>;
    error?: unknown;
  };
  const lines = [record.message];
  const fields = [
    ["status", record.status],
    ["code", record.code],
    ["type", record.type],
    ["param", record.param],
    ["request_id", record.request_id ?? record.requestID]
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  if (fields.length > 0) {
    lines.push("");
    for (const [key, value] of fields) {
      lines.push(`${key}: ${String(value)}`);
    }
  }

  const relevantHeaders = pickHeaders(record.headers, [
    "retry-after",
    "x-ratelimit-limit",
    "x-ratelimit-remaining",
    "x-ratelimit-reset",
    "x-request-id"
  ]);
  if (Object.keys(relevantHeaders).length > 0) {
    lines.push("", "headers:");
    for (const [key, value] of Object.entries(relevantHeaders)) {
      lines.push(`  ${key}: ${String(value)}`);
    }
  }

  if (debug) {
    if (record.error !== undefined) {
      lines.push("", "provider_error:", stringify(record.error));
    }
    if (record.headers && Object.keys(record.headers).length > 0) {
      lines.push("", "all_headers:", stringify(record.headers));
    }
    if (record.stack) {
      lines.push("", "stack:", record.stack);
    }
  } else {
    lines.push("", "Run again with --debug to print provider metadata and stack details.");
  }

  return lines.join("\n");
}

function pickHeaders(headers: Record<string, unknown> | undefined, names: string[]): Record<string, unknown> {
  if (!headers) return {};
  const normalized = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return Object.fromEntries(names.flatMap((name) => {
    const value = normalized.get(name);
    return value === undefined ? [] : [[name, value]];
  }));
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
