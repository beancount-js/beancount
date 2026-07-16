import { promises as fs } from "node:fs";
import { join } from "node:path";
import { parseDotenvEntries } from "@beancount-js/workspace";

type CachedProjectEnv = {
  mtimeMs: number;
  entries: Record<string, string>;
};

const cache = new Map<string, CachedProjectEnv>();

/** Read project-root `.env` values (server-side only). */
export async function readProjectEnvEntries(
  root: string,
): Promise<Record<string, string>> {
  const path = join(root, ".env");
  try {
    const stats = await fs.stat(path);
    const cached = cache.get(root);
    if (cached && cached.mtimeMs === stats.mtimeMs) return cached.entries;
    const contents = await fs.readFile(path, "utf8");
    const entries = parseDotenvEntries(contents);
    cache.set(root, { mtimeMs: stats.mtimeMs, entries });
    return entries;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      cache.delete(root);
      return {};
    }
    throw error;
  }
}

/** process.env overlaid with project `.env` (project wins on key collision). */
export async function resolveProjectEnv(
  root: string | undefined,
): Promise<NodeJS.ProcessEnv> {
  if (!root) return { ...process.env };
  const project = await readProjectEnvEntries(root);
  return { ...process.env, ...project };
}

export function resolveEnvSecret(
  reference: string | undefined,
  env: NodeJS.ProcessEnv,
): string | undefined {
  if (!reference?.trim()) return undefined;
  if (reference.startsWith("env:")) {
    const name = reference.slice("env:".length);
    return name ? env[name] : undefined;
  }
  return reference;
}

export function envSecretAvailable(
  reference: string | undefined,
  env: NodeJS.ProcessEnv,
): boolean {
  if (!reference?.trim()) return false;
  if (!reference.startsWith("env:")) return true;
  const name = reference.slice("env:".length);
  return Boolean(name && env[name]);
}
