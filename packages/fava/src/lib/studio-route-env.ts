/** Mutable route context for link builders that cannot take project/ledger props. */

type StudioRouteEnv = {
  projectId: string;
  /** Canonical ledger file path (with extension). */
  ledgerPath: string;
  /** URL stem (often extensionless). */
  ledgerStem: string;
  availableLedgers: string[];
};

const env: StudioRouteEnv = {
  projectId: "",
  ledgerPath: "",
  ledgerStem: "",
  availableLedgers: [],
};

export function getStudioRouteEnv(): Readonly<StudioRouteEnv> {
  return env;
}

export function setStudioRouteEnv(next: Partial<StudioRouteEnv>) {
  if (next.projectId !== undefined) env.projectId = next.projectId;
  if (next.ledgerPath !== undefined) env.ledgerPath = next.ledgerPath;
  if (next.ledgerStem !== undefined) env.ledgerStem = next.ledgerStem;
  if (next.availableLedgers !== undefined) {
    env.availableLedgers = next.availableLedgers;
  }
}
