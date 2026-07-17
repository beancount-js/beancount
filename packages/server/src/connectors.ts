import { registerConnector, hasConnector } from "@beancount-js/beangulp";
import { lunchflowConnector } from "@beancount-js/connector-lunchflow";
import { monzoConnector } from "@beancount-js/connector-monzo";
import { starlingConnector } from "@beancount-js/connector-starling";

let registered = false;

/** Idempotently register built-in ingestion connectors. */
export function ensureConnectorsRegistered() {
  if (registered) return;
  if (!hasConnector(lunchflowConnector.kind)) {
    registerConnector(lunchflowConnector);
  }
  if (!hasConnector(monzoConnector.kind)) {
    registerConnector(monzoConnector);
  }
  if (!hasConnector(starlingConnector.kind)) {
    registerConnector(starlingConnector);
  }
  registered = true;
}
