import { DateTime } from "luxon";
import { createBeancountController } from "@beancount-js/ui/controller";
import { createInMemorySource } from "./in-memory-source";
import { NOW } from "../fixtures/project";
import { reviewProject } from "../fixtures/review-project";
export type CatalogScenario =
  | "ready"
  | "loading"
  | "empty"
  | "error"
  | "review";
export function createInMemoryBeancountController(
  initialRoute = "/dashboard",
  scenario: CatalogScenario = "ready",
) {
  const source = createInMemorySource(
    scenario === "empty"
      ? []
      : scenario === "review"
        ? [reviewProject()]
        : undefined,
  );
  let failed = false;
  return createBeancountController({
    source: {
      ...source,
      listProjects(signal) {
        if (scenario === "loading")
          return new Promise((_, reject) => {
            if (signal?.aborted) reject(signal.reason);
            else
              signal?.addEventListener("abort", () => reject(signal.reason), {
                once: true,
              });
          });
        if (scenario === "error" && !failed) {
          failed = true;
          return Promise.reject(
            new Error("The project is temporarily unavailable."),
          );
        }
        return source.listProjects(signal);
      },
    },
    initialRoute,
    clock: () => DateTime.fromISO(NOW),
  });
}
