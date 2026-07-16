import {
  getConnector,
  hasConnector,
  listConnectors,
  registerConnector,
  type ConnectorDefinition,
} from "@beancount-js/beangulp";
import { lunchflowConnector } from "@beancount-js/connector-lunchflow";

let registered = false;

/** Register built-in connectors for client-side catalog/forms. */
export function ensureClientConnectors() {
  if (registered) return;
  if (!hasConnector(lunchflowConnector.kind)) {
    registerConnector(lunchflowConnector);
  }
  registered = true;
}

export function clientConnectors(): readonly ConnectorDefinition[] {
  ensureClientConnectors();
  return listConnectors();
}

export function clientConnector(kind: string) {
  ensureClientConnectors();
  return getConnector(kind);
}

export function isConnectorSource(source: { kind: string }) {
  ensureClientConnectors();
  return source.kind !== "json-api" && hasConnector(source.kind);
}

export function isGroupedSource(source: {
  kind: string;
  accounts?: readonly unknown[];
}) {
  if (isConnectorSource(source)) {
    return (
      clientConnector(source.kind)?.capabilities.groupedAccounts === true ||
      Array.isArray(source.accounts)
    );
  }
  return Array.isArray(source.accounts);
}

export function sourceConfigRecord(
  source: { kind: string; config?: unknown; api?: { secretRef?: string; baseUrl?: string; authScheme?: string; allowedHosts?: string[] } },
): Record<string, unknown> {
  if (isConnectorSource(source) && source.config && typeof source.config === "object") {
    return source.config as Record<string, unknown>;
  }
  return {
    secretRef: source.api?.secretRef,
    baseUrl: source.api?.baseUrl,
    authScheme: source.api?.authScheme,
    allowedHosts: source.api?.allowedHosts,
  };
}

export function sourceSecretRef(source: {
  kind: string;
  config?: unknown;
  api?: { secretRef?: string };
}): string | undefined {
  if (isConnectorSource(source)) {
    const config = source.config as { secretRef?: unknown } | undefined;
    return typeof config?.secretRef === "string" ? config.secretRef : undefined;
  }
  return source.api?.secretRef;
}

export function sourceBaseUrl(source: {
  kind: string;
  config?: unknown;
  api?: { baseUrl?: string };
}): string | undefined {
  if (isConnectorSource(source)) {
    const config = source.config as { baseUrl?: unknown } | undefined;
    return typeof config?.baseUrl === "string" ? config.baseUrl : undefined;
  }
  return source.api?.baseUrl;
}
