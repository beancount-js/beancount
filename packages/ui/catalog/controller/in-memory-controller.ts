import { DateTime } from "luxon";
import { createBeancountController } from "../../src/controller";
import { createInMemorySource } from "./in-memory-source";
import { NOW } from "../fixtures/project";
export function createInMemoryBeancountController(initialRoute = "/dashboard") {
  return createBeancountController({
    source: createInMemorySource(),
    initialRoute,
    clock: () => DateTime.fromISO(NOW),
  });
}
