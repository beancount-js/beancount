import {
  getConnector,
  hasConnector,
  type ConnectorSyncState,
} from "@beancount-js/beangulp";
import { ensureConnectorsRegistered } from "./connectors";
import type {
  BrandfetchEnrichmentConfig,
  IngestionConfig,
  IngestionReconciliationConfig,
  IngestionSourceDefinition,
  MerchantEnrichmentConfig,
} from "./ingestion";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function lunchflowHost(baseUrl: string | undefined) {
  if (!baseUrl) return false;
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    return host === "lunchflow.app" || host === "www.lunchflow.app";
  } catch {
    return false;
  }
}

function stripBrandfetch(
  enrichment: MerchantEnrichmentConfig | undefined,
): MerchantEnrichmentConfig | undefined {
  if (!enrichment) return undefined;
  const { brandfetch: _brandfetch, ...rest } = enrichment;
  return rest;
}

function migrateLunchflowSource(
  source: Record<string, unknown>,
): IngestionSourceDefinition {
  const api = isRecord(source.api) ? source.api : {};
  const connector = getConnector("lunchflow");
  const defaults = connector?.defaultConfig() as
    | Record<string, unknown>
    | undefined;
  const config = {
    ...(defaults ?? {}),
    secretRef:
      typeof api.secretRef === "string"
        ? api.secretRef
        : (defaults?.secretRef ?? "env:LUNCHFLOW_API_KEY"),
    baseUrl:
      typeof api.baseUrl === "string"
        ? api.baseUrl
        : (defaults?.baseUrl ?? "https://www.lunchflow.app/api/v1"),
    allowedHosts: Array.isArray(api.allowedHosts)
      ? api.allowedHosts
      : (defaults?.allowedHosts ?? ["lunchflow.app", "www.lunchflow.app"]),
  };
  const migrated: IngestionSourceDefinition = {
    id: String(source.id),
    name: String(source.name ?? "Lunch Flow"),
    kind: "lunchflow",
    merchantId:
      typeof source.merchantId === "string"
        ? source.merchantId.trim() || undefined
        : undefined,
    destinationPath:
      typeof source.destinationPath === "string"
        ? source.destinationPath
        : undefined,
    defaultCurrency:
      typeof source.defaultCurrency === "string"
        ? source.defaultCurrency
        : undefined,
    reconciliationPriority:
      typeof source.reconciliationPriority === "number"
        ? source.reconciliationPriority
        : undefined,
    allowedAccountRoots: Array.isArray(source.allowedAccountRoots)
      ? (source.allowedAccountRoots as string[])
      : undefined,
    aiEnabled: source.aiEnabled === true,
    setup: typeof source.setup === "string" ? source.setup : undefined,
    rules: Array.isArray(source.rules) ? (source.rules as never[]) : [],
    accounts: Array.isArray(source.accounts)
      ? (source.accounts as never[])
      : [],
    config,
  };
  const merchantEnrichment = stripBrandfetch(
    source.merchantEnrichment as MerchantEnrichmentConfig | undefined,
  );
  if (merchantEnrichment) migrated.merchantEnrichment = merchantEnrichment;
  return migrated;
}

/** Promote nested Brandfetch + rewrite Lunchflow json-api templates. */
export function migrateIngestionConfig(raw: unknown): IngestionConfig {
  ensureConnectorsRegistered();
  const record = isRecord(raw) ? raw : {};
  const sourcesIn = Array.isArray(record.sources) ? record.sources : [];
  let brandfetch = isRecord(record.brandfetch)
    ? (record.brandfetch as unknown as BrandfetchEnrichmentConfig)
    : undefined;
  const reconciliation = isRecord(record.reconciliation)
    ? (record.reconciliation as IngestionReconciliationConfig)
    : undefined;

  const sources: IngestionSourceDefinition[] = [];
  for (const item of sourcesIn) {
    if (!isRecord(item)) continue;
    const enrichment = item.merchantEnrichment as
      | MerchantEnrichmentConfig
      | undefined;
    if (!brandfetch && enrichment?.brandfetch) {
      brandfetch = enrichment.brandfetch;
    }

    const kind = typeof item.kind === "string" ? item.kind : "json-api";
    const api = isRecord(item.api) ? item.api : undefined;
    const looksLikeLunchflow =
      kind === "lunchflow" ||
      item.id === "lunchflow" ||
      (kind === "json-api" &&
        lunchflowHost(
          typeof api?.baseUrl === "string" ? api.baseUrl : undefined,
        ));

    if (looksLikeLunchflow && kind !== "lunchflow") {
      sources.push(migrateLunchflowSource(item));
      continue;
    }

    if (kind !== "json-api" && hasConnector(kind)) {
      const migrated: IngestionSourceDefinition = {
        ...(item as unknown as IngestionSourceDefinition),
        kind,
        config: item.config ?? {},
        rules: Array.isArray(item.rules) ? (item.rules as never[]) : [],
      };
      const nextEnrichment = stripBrandfetch(enrichment);
      if (nextEnrichment) migrated.merchantEnrichment = nextEnrichment;
      else delete migrated.merchantEnrichment;
      sources.push(migrated);
      continue;
    }

    const migrated: IngestionSourceDefinition = {
      ...(item as unknown as IngestionSourceDefinition),
      kind: "json-api",
      api: (api ?? {}) as never,
      mapping: (isRecord(item.mapping) ? item.mapping : {}) as never,
      rules: Array.isArray(item.rules) ? (item.rules as never[]) : [],
    };
    const nextEnrichment = stripBrandfetch(enrichment);
    if (nextEnrichment) migrated.merchantEnrichment = nextEnrichment;
    else delete migrated.merchantEnrichment;
    sources.push(migrated);
  }

  return {
    version: 3,
    ...(brandfetch ? { brandfetch } : {}),
    ...(reconciliation ? { reconciliation } : {}),
    sources,
  };
}

export function parseIngestionState(raw: unknown): {
  version: 5;
  cursors: Record<string, string | undefined>;
  syncState: Record<string, ConnectorSyncState>;
  seenImportIds: string[];
  seenFingerprints: string[];
  seenProviderImportIds: string[];
} {
  const record = isRecord(raw) ? raw : {};
  return {
    version: 5,
    cursors: isRecord(record.cursors)
      ? (record.cursors as Record<string, string | undefined>)
      : {},
    syncState: isRecord(record.syncState)
      ? (record.syncState as Record<string, ConnectorSyncState>)
      : {},
    seenImportIds: Array.isArray(record.seenImportIds)
      ? (record.seenImportIds as string[])
      : [],
    seenFingerprints: Array.isArray(record.seenFingerprints)
      ? (record.seenFingerprints as string[])
      : [],
    seenProviderImportIds: Array.isArray(record.seenProviderImportIds)
      ? (record.seenProviderImportIds as string[])
      : [],
  };
}
