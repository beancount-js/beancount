import { homedir } from "node:os";
import { join } from "node:path";

/** App-specific directory inside a ledger project root. */
export const PROJECT_STUDIO_DIR = ".beancount";

/**
 * Global Studio config root (project registry only).
 * `XDG_CONFIG_HOME` is treated as a base; `beancount-js` is always appended.
 */
export function studioConfigRoot(override?: string) {
  if (override) return override;
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(base, "beancount-js");
}

/** Project-local Studio data root: `<projectRoot>/.beancount`. */
export function projectStudioRoot(projectRoot: string) {
  return join(projectRoot, PROJECT_STUDIO_DIR);
}

/** Project-local ingestion root: `<projectRoot>/.beancount/ingestion`. */
export function projectIngestionRoot(projectRoot: string) {
  return join(projectStudioRoot(projectRoot), "ingestion");
}

/** Project-local AI session root: `<projectRoot>/.beancount/ai-sessions`. */
export function projectAiSessionsRoot(projectRoot: string) {
  return join(projectStudioRoot(projectRoot), "ai-sessions");
}
