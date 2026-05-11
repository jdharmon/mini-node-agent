import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export function recursiveMerge<T extends Record<string, unknown>>(...objects: Array<Record<string, unknown> | undefined>): T {
  const result: Record<string, unknown> = {};
  for (const object of objects) {
    if (!object) continue;
    for (const [key, value] of Object.entries(object)) {
      const current = result[key];
      if (isPlainObject(current) && isPlainObject(value)) {
        result[key] = recursiveMerge(current, value);
      } else if (value !== undefined) {
        result[key] = value;
      }
    }
  }
  return result as T;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, key: string) => {
    const value = getPath(vars, key);
    return value === undefined || value === null ? "" : String(value);
  });
}

function getPath(vars: Record<string, unknown>, path: string): unknown {
  let current: unknown = vars;
  for (const part of path.split(".")) {
    if (!isPlainObject(current)) return undefined;
    current = current[part];
  }
  return current;
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function parseScalar(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function setDottedValue(key: string, value: unknown): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  let current = root;
  const parts = key.split(".");
  for (const part of parts.slice(0, -1)) {
    current[part] = {};
    current = current[part] as Record<string, unknown>;
  }
  current[parts.at(-1)!] = value;
  return root;
}
