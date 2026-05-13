import { resolve, sep } from "node:path";

export function resolveInsideCwd(
  path: string | undefined,
  cwd: string
): { ok: true; absolute: string } | { ok: false; error: string } {
  if (!path) return { ok: false, error: "Missing file path argument." };
  const root = resolve(cwd);
  const absolute = resolve(root, path);
  if (absolute !== root && !absolute.startsWith(root + sep)) {
    return { ok: false, error: `Path '${path}' is outside the working directory.` };
  }
  return { ok: true, absolute };
}
