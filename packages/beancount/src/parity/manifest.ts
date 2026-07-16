export const UPSTREAM_COMMIT = "a3cb3fd9f946d6213dd350fb87709a8ef198301d";

export const parityStatuses = ["matched", "adapted", "excluded"] as const;
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
  records: ReadonlyArray<ParityRecord>;
}

export function validateParityManifest(manifest: ParityManifest): string[] {
  const errors: string[] = [];
  if (manifest.upstreamCommit !== UPSTREAM_COMMIT) {
    errors.push(`Expected upstream commit ${UPSTREAM_COMMIT}`);
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
    if (record.status !== "excluded" && record.tests.length === 0) {
      errors.push(`${identifier} must name at least one test or fixture`);
    }
    if (record.status === "excluded" && !record.reason) {
      errors.push(`${identifier} must explain its exclusion`);
    }
  }
  return errors;
}
