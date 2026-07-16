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

/** Cached Brandfetch API responses: `<projectRoot>/.beancount/ingestion/brandfetch/responses`. */
export function projectBrandfetchCacheRoot(projectRoot: string) {
  return join(projectIngestionRoot(projectRoot), "brandfetch", "responses");
}

/** Project-local AI session root: `<projectRoot>/.beancount/ai-sessions`. */
export function projectAiSessionsRoot(projectRoot: string) {
  return join(projectStudioRoot(projectRoot), "ai-sessions");
}

/** Global detection rules: `<projectRoot>/.beancount/rules.json`. */
export function projectRulesPath(projectRoot: string) {
  return join(projectStudioRoot(projectRoot), "rules.json");
}

/** Detection rule run history: `<projectRoot>/.beancount/rule-runs.json`. */
export function projectRuleRunsPath(projectRoot: string) {
  return join(projectStudioRoot(projectRoot), "rule-runs.json");
}
