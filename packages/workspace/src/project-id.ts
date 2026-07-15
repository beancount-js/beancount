/** Changeyard-style project IDs: folder-name slug + short suffix on collision. */

export const PROJECT_ID_COLLISION_SUFFIX_LENGTH = 4;

/** Path segments reserved by the Studio HTTP app (must not be bare project IDs). */
export const RESERVED_PROJECT_IDS = new Set(["api"]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProjectIdIndex = {
  /** Absolute root (server) or directory key (browser) → project id. */
  rootPathToId: Record<string, string>;
  /** Project id → absolute root / directory key. */
  idToRoot: Record<string, string>;
};

export function isUuidProjectId(id: string) {
  return UUID_PATTERN.test(id);
}

export function toProjectIdBase(folderOrPath: string) {
  const trimmed = folderOrPath.trim().replace(/[\\/]+$/g, "");
  const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  const folderName = (slash >= 0 ? trimmed.slice(slash + 1) : trimmed) || "project";
  const normalized = folderName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = normalized || "project";
  return RESERVED_PROJECT_IDS.has(base) ? "project" : base;
}

export function createProjectIdCollisionSuffix(
  length = PROJECT_ID_COLLISION_SUFFIX_LENGTH,
  random: () => number = Math.random,
) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  while (suffix.length < length) {
    suffix += alphabet[Math.floor(random() * alphabet.length)] ?? "0";
  }
  return suffix;
}

function idTakenByOtherRoot(
  index: ProjectIdIndex,
  candidate: string,
  rootKey: string,
) {
  const owner = index.idToRoot[candidate];
  return Boolean(owner && owner !== rootKey);
}

/**
 * Allocate a stable slug id for `rootKey`. Reuses an existing mapping when present.
 */
export function createProjectId(
  index: ProjectIdIndex,
  rootKey: string,
  options?: { random?: () => number },
) {
  const existing = index.rootPathToId[rootKey];
  if (existing && index.idToRoot[existing] === rootKey) return existing;

  const baseId = toProjectIdBase(rootKey);
  if (!idTakenByOtherRoot(index, baseId, rootKey)) return baseId;

  const random = options?.random ?? Math.random;
  for (let attempt = 0; attempt < 256; attempt += 1) {
    const candidate = `${baseId}-${createProjectIdCollisionSuffix(
      PROJECT_ID_COLLISION_SUFFIX_LENGTH,
      random,
    )}`;
    if (!idTakenByOtherRoot(index, candidate, rootKey)) return candidate;
  }

  throw new Error(`Could not generate a unique project ID for ${rootKey}.`);
}

export function projectIdIndexFromProjects(
  projects: ReadonlyArray<{ id: string; rootKey: string }>,
): ProjectIdIndex {
  const rootPathToId: Record<string, string> = {};
  const idToRoot: Record<string, string> = {};
  for (const project of projects) {
    rootPathToId[project.rootKey] = project.id;
    idToRoot[project.id] = project.rootKey;
  }
  return { rootPathToId, idToRoot };
}
