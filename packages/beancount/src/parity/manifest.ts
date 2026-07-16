export const UPSTREAM_COMMIT = "a3cb3fd9f946d6213dd350fb87709a8ef198301d";

export const parityStatuses = [
  "matched",
  "adapted",
  "pending",
  "excluded",
] as const;
export type ParityStatus = (typeof parityStatuses)[number];

export interface ParityRecord {
  upstreamModule: string;
  upstreamBehavior: string;
  localBehavior: string;
  status: ParityStatus;
  tests: ReadonlyArray<string>;
  reason?: string;
}

export interface ParityManifest {
  upstreamCommit: string;
  inScopeUpstreamModules: ReadonlyArray<string>;
  inScopeUpstreamTestModules: ReadonlyArray<string>;
  records: ReadonlyArray<ParityRecord>;
}

export function validateParityManifest(manifest: ParityManifest): string[] {
  const errors: string[] = [];
  if (manifest.upstreamCommit !== UPSTREAM_COMMIT) {
    errors.push(`Expected upstream commit ${UPSTREAM_COMMIT}`);
  }

  const declaredModules = new Set<string>();
  for (const module of manifest.inScopeUpstreamModules) {
    if (declaredModules.has(module))
      errors.push(`Duplicate in-scope module ${module}`);
    declaredModules.add(module);
  }

  const declaredTests = new Set<string>();
  for (const testModule of manifest.inScopeUpstreamTestModules) {
    if (declaredTests.has(testModule))
      errors.push(`Duplicate in-scope test module ${testModule}`);
    declaredTests.add(testModule);
  }

  const seen = new Set<string>();
  for (const record of manifest.records) {
    const identifier = `${record.upstreamModule}:${record.upstreamBehavior}`;
    if (seen.has(identifier))
      errors.push(`Duplicate parity record ${identifier}`);
    seen.add(identifier);
    if (!parityStatuses.includes(record.status)) {
      errors.push(`${identifier} has an unsupported status`);
    }
    if (
      (record.status === "matched" || record.status === "adapted") &&
      record.tests.length === 0
    ) {
      errors.push(`${identifier} must name at least one test or fixture`);
    }
    if (
      (record.status === "excluded" || record.status === "pending") &&
      !record.reason
    ) {
      errors.push(`${identifier} must explain its ${record.status} status`);
    }
  }

  for (const module of declaredModules) {
    if (!manifest.records.some((record) => record.upstreamModule === module)) {
      errors.push(`${module} has no parity record`);
    }
  }
  return errors;
}

/** Checks the release gate in addition to ordinary manifest consistency. */
export function validateParityCompletion(manifest: ParityManifest): string[] {
  return [
    ...validateParityManifest(manifest),
    ...manifest.records
      .filter((record) => record.status === "pending")
      .map(
        (record) =>
          `${record.upstreamModule}:${record.upstreamBehavior} is still pending`,
      ),
  ];
}
