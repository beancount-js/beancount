import type {
  IngestionRun,
  NormalizerPlugin,
  SourceContext,
  SourcePlugin,
} from "../types";
import type { MerchantRule } from "../categorize";

export type ConnectorFieldKind =
  | "text"
  | "url"
  | "secret"
  | "switch"
  | "segmented"
  | "textarea";

export interface ConnectorFieldSpec {
  id: string;
  label: string;
  kind: ConnectorFieldKind;
  /** Dot-path into connector `config`. */
  path: string;
  placeholder?: string;
  options?: readonly { value: string; label: string }[];
  default?: unknown;
}

/** Opaque per-target sync bookmark. Shape is connector-owned. */
export type ConnectorSyncState = Record<string, unknown>;

export interface SyncPrepareResult {
  /** Passed into SourceContext.fetchContext for this run. */
  fetchContext: Record<string, unknown>;
  /** Optional legacy string cursor for pipelines that still use `cursor`. */
  cursor?: string;
}

/** Linked bank account under a grouped connector connection. */
export interface ConnectorLinkedAccount {
  id: string;
  name: string;
  sourceAccount: string;
  defaultCurrency?: string;
}

export interface DiscoveredConnectorAccount {
  id: string;
  name: string;
  currency?: string;
  institutionName?: string;
  status?: string;
  iban?: string;
}

/** Kind-agnostic persisted source shell; provider quirks live in `config`. */
export interface ConnectorSourceDefinition<TConfig = unknown> {
  id: string;
  name: string;
  kind: string;
  destinationPath?: string;
  defaultCurrency?: string;
  allowedAccountRoots?: string[];
  aiEnabled?: boolean;
  setup?: string;
  /** Per-source categorisation/merchant AI — no Brandfetch here. */
  merchantEnrichment?: {
    enabled: boolean;
    aiEnabled?: boolean;
    countryCode?: string;
  };
  rules: MerchantRule[];
  accounts?: ConnectorLinkedAccount[];
  sourceAccount?: string;
  config: TConfig;
}

export interface ExpandedConnectorTarget {
  sourceId: string;
  sourceAccount: string;
  defaultCurrency?: string;
  /** Remote provider account id for grouped connectors. */
  accountId?: string;
}

export interface ConnectorCatalogMeta {
  initials: string;
  accentClass: string;
  region: string;
  category: string;
  badge?: string;
}

export interface ConnectorDefinition<
  TConfig = unknown,
  TSync extends ConnectorSyncState = ConnectorSyncState,
> {
  kind: string;
  name: string;
  description: string;
  catalog: ConnectorCatalogMeta;
  capabilities: {
    groupedAccounts: boolean;
    discoverAccounts: boolean;
  };
  setupMarkdown: string;
  connectionFields: readonly ConnectorFieldSpec[];
  advancedFields: readonly ConnectorFieldSpec[];
  defaultConfig(): TConfig;
  validateConfig(value: unknown): TConfig;
  createSource(config: TConfig): SourcePlugin<TConfig, unknown>;
  createNormalizer(config: TConfig): NormalizerPlugin<unknown>;
  discoverAccounts?(
    config: TConfig,
    ctx: SourceContext,
  ): Promise<DiscoveredConnectorAccount[]>;
  expandTargets(
    source: ConnectorSourceDefinition<TConfig>,
    opts?: { accountId?: string },
  ): ExpandedConnectorTarget[];
  prepareFetch(args: {
    config: TConfig;
    sourceId: string;
    accountId?: string;
    syncState?: TSync;
    now?: Date;
  }): SyncPrepareResult;
  commitSyncState(args: {
    config: TConfig;
    sourceId: string;
    previous?: TSync;
    prepare: SyncPrepareResult;
    run: Pick<IngestionRun, "cursor" | "completedAt" | "proposals">;
    now?: Date;
  }): TSync;
}

/** Stable ingest / cursor key for a nested account under a connection. */
export function connectorAccountSourceId(
  connectionId: string,
  accountId: string,
) {
  return `${connectionId}:${accountId}`;
}

export function isGroupedConnectorSource(source: {
  accounts?: readonly unknown[] | undefined;
  kind?: string;
}): boolean {
  return Array.isArray(source.accounts);
}
