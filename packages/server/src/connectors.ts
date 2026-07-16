import { registerConnector, hasConnector } from "@beancount-js/beangulp";
import { lunchflowConnector } from "@beancount-js/connector-lunchflow";

let registered = false;

/** Idempotently register built-in ingestion connectors. */
export function ensureConnectorsRegistered() {
  if (registered) return;
  if (!hasConnector(lunchflowConnector.kind)) {
    registerConnector(lunchflowConnector);
  }
  registered = true;
}
