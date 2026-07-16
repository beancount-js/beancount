import type { ConnectorDefinition } from "./types";

const connectors = new Map<string, ConnectorDefinition>();

export function registerConnector(connector: ConnectorDefinition) {
  if (!connector.kind?.trim()) {
    throw new Error("Connector kind is required.");
  }
  if (connectors.has(connector.kind)) {
    throw new Error(`Connector already registered: ${connector.kind}`);
  }
  connectors.set(connector.kind, connector);
}

export function getConnector(kind: string): ConnectorDefinition | undefined {
  return connectors.get(kind);
}

export function requireConnector(kind: string): ConnectorDefinition {
  const connector = getConnector(kind);
  if (!connector) {
    throw new Error(`Unknown ingestion connector: ${kind}`);
  }
  return connector;
}

export function listConnectors(): readonly ConnectorDefinition[] {
  return [...connectors.values()];
}

export function hasConnector(kind: string) {
  return connectors.has(kind);
}

/** Test helper — clears the registry. */
export function clearConnectorRegistry() {
  connectors.clear();
}
