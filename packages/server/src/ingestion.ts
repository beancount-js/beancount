import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  JsonApiSource,
  JsonMappingNormalizer,
  RuleActionsHook,
  RuleCategorizer,
  HistoricalCategorizer,
  RecurringCategorizer,
  historySamplesFromEntries,
  summarizeIngestionProposals,
  migrateMerchantRules,
  runIngestion,
  normalizeMerchant,
  sortSuggestions,
  transactionFingerprint,
  providerImportIdentity,
  discoverJsonApiAccounts,
  isGroupedJsonApiSource,
  jsonApiAccountSourceId,
  jsonApiAccountTransactionsEndpoint,
  getConnector,
  hasConnector,
  requireConnector,
  type AiEnrichmentCallRecord,
  type AiEnrichmentSnapshot,
  type CategorizationContext,
  type CategorizerPlugin,
  type CategoryEvidence,
  type CategorySuggestion,
  type ConnectorSourceDefinition,
  type ConnectorSyncState,
  type DetectionRule,
  type DiscoveredJsonApiAccount,
  type ImportProposal,
  type IngestionProgress,
  type IngestionRun,
  type ProposalAcceptance,
  type NormalizedTransactionPatch,
  type JsonApiLinkedAccount,
  type JsonApiSourceConfig,
  type JsonMappingConfig,
  type MerchantRule,
  type MerchantCandidate,
  type MerchantResolution,
  type MerchantResolverPlugin,
  type ProposalHook,
} from "@beancount-js/beangulp";
import { ensureConnectorsRegistered } from "./connectors";
import {
  migrateIngestionConfig,
  parseIngestionState,
} from "./ingestion-migrate";
import type { Directive } from "@beancount-js/beancount";
import { isValidDomain } from "./brandfetch";
import {
  BrandfetchLogoService,
  type BrandfetchLogoDelivery,
} from "./brandfetch-logo";
import { FilesystemMerchantStore, type ProjectRootResolver } from "./merchant";
import { projectIngestionRoot } from "./paths";
import {
  FilesystemIngestionRunArchive,
  type IngestionRunPage,
} from "./ingestion-runs";
import { resolveEnvSecret, resolveProjectEnv } from "./project-env";

const VERSION = 3;
const STATE_VERSION = 5;
const SEEN_LIMIT = 10_000;

export interface IngestionReconciliationConfig {
  duplicateWindowDays?: number;
  transferWindowDays?: number;
  fxRateTolerance?: number;
}

export interface BrandfetchEnrichmentConfig {
  enabled: boolean;
  clientId?: string;
  /** Store validated logo files beside merchant profiles, or proxy only. */
  delivery?: BrandfetchLogoDelivery;
  /** Lazy local-cache refresh interval. */
  refreshDays?: number;
  /** Request 120px logos instead of the default 40px variant. */
  highResolution?: boolean;
}

export interface MerchantEnrichmentConfig {
  enabled: boolean;
  aiEnabled?: boolean;
  countryCode?: string;
  /** @deprecated Prefer IngestionConfig.brandfetch. */
  brandfetch?: BrandfetchEnrichmentConfig;
}

export interface IngestionSourceDefinition {
  id: string;
  name: string;
  kind: string;
  /** Optional project merchant used to present this connection in the UI. */
  merchantId?: string;
  /**
   * Beancount asset account for standalone sources.
   * Grouped connections set this per nested `accounts[]` entry instead.
   */
  sourceAccount?: string;
  destinationPath?: string;
  defaultCurrency?: string;
  /** Higher-priority connections provide canonical fields for an overlap. */
  reconciliationPriority?: number;
  allowedAccountRoots?: string[];
  aiEnabled?: boolean;
  /** Markdown shown in the connection preview setup callout. */
  setup?: string;
  merchantEnrichment?: MerchantEnrichmentConfig;
  /** Legacy json-api transport config. */
  api?: JsonApiSourceConfig;
  /** Legacy json-api field mapping. */
  mapping?: JsonMappingConfig;
  /** Connector-owned config for registered kinds (e.g. lunchflow). */
  config?: unknown;
  rules: MerchantRule[];
  /** Nested bank accounts for multi-account providers (e.g. Lunch Flow). */
  accounts?: JsonApiLinkedAccount[];
}

export interface IngestionConfig {
  version: 1 | 2 | 3;
  /** Global Brandfetch / brand-match settings. */
  brandfetch?: BrandfetchEnrichmentConfig;
  /** Project-wide matching windows and FX tolerance. */
  reconciliation?: IngestionReconciliationConfig;
  sources: IngestionSourceDefinition[];
}

export type IngestionSyncJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export interface IngestionSyncJobProgress {
  stage: IngestionProgress["stage"] | "queued" | "saving";
  message: string;
  accountIndex?: number;
  accountTotal?: number;
  accountName?: string;
  pagesFetched?: number;
  seen?: number;
  imported?: number;
}

export interface IngestionSyncJobSummary {
  seen: number;
  imported: number;
  ready: number;
  needsReview: number;
  duplicates: number;
  invalid: number;
  held: number;
  excluded?: number;
}

export type IngestionSyncJobKind = "sync" | "ai-rerun";

export interface IngestionSyncJob {
  id: string;
  projectId: string;
  sourceId: string;
  /** Defaults to `"sync"` for older persisted jobs. */
  kind?: IngestionSyncJobKind;
  status: IngestionSyncJobStatus;
  startedAt: string;
  completedAt?: string;
  error?: string;
  progress: IngestionSyncJobProgress;
  runIds: string[];
  summary?: IngestionSyncJobSummary;
}

export interface IngestProgressOptions {
  accountId?: string;
  onProgress?: (progress: IngestionProgress) => void | Promise<void>;
  /** Global detection rules; falls back to migrating legacy source.rules. */
  detectionRules?: readonly DetectionRule[];
}

function resolveDetectionRules(
  source: IngestionSourceDefinition,
  options?: { detectionRules?: readonly DetectionRule[] },
): DetectionRule[] {
  if (options?.detectionRules) return [...options.detectionRules];
  return migrateMerchantRules(source.rules ?? []);
}

function buildCategorizers(
  detectionRules: readonly DetectionRule[],
  options?: {
    aiEnabled?: boolean;
    model?: string;
    onAiDebug?: (call: AiEnrichmentDebugCall) => void;
  },
): CategorizerPlugin[] {
  const categorizers: CategorizerPlugin[] = [
    new RuleCategorizer(detectionRules),
    new HistoricalCategorizer(),
    new RecurringCategorizer(),
  ];
  if (options?.aiEnabled) {
    categorizers.push(
      new CodexCategorizer({
        model: options.model,
        onDebug: options.onAiDebug,
      }),
    );
  }
  return categorizers;
}

function buildRuleHooks(
  detectionRules: readonly DetectionRule[],
): ProposalHook[] {
  return detectionRules.length > 0 ? [new RuleActionsHook(detectionRules)] : [];
}

interface IngestionState {
  version: 5;
  cursors: Record<string, string | undefined>;
  /** Connector-owned sync bookmarks keyed by target sourceId. */
  syncState: Record<string, ConnectorSyncState>;
  seenImportIds: string[];
  /** Version 4 values include the concrete target source id. */
  seenFingerprints: string[];
  /** Exact connector/provider record ids, independent of a connection id. */
  seenProviderImportIds: string[];
}

function projectId(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value))
    throw new Error("Invalid project identifier.");
  return value;
}

function sourceId(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value))
    throw new Error(
      "Source identifiers may use only letters, numbers, hyphens, and underscores.",
    );
  return value;
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path, "utf8")) as T;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

function configDefaults(): IngestionConfig {
  return { version: VERSION, sources: [] };
}

export function validateReconciliationConfig(
  value: IngestionReconciliationConfig | undefined,
) {
  if (!value) return undefined;
  const duplicateWindowDays = value.duplicateWindowDays;
  const transferWindowDays = value.transferWindowDays;
  const fxRateTolerance = value.fxRateTolerance;
  if (
    duplicateWindowDays !== undefined &&
    (!Number.isInteger(duplicateWindowDays) ||
      duplicateWindowDays < 0 ||
      duplicateWindowDays > 31)
  ) {
    throw new Error(
      "reconciliation.duplicateWindowDays must be an integer from 0 to 31.",
    );
  }
  if (
    transferWindowDays !== undefined &&
    (!Number.isInteger(transferWindowDays) ||
      transferWindowDays < 0 ||
      transferWindowDays > 31)
  ) {
    throw new Error(
      "reconciliation.transferWindowDays must be an integer from 0 to 31.",
    );
  }
  if (
    fxRateTolerance !== undefined &&
    (!Number.isFinite(fxRateTolerance) ||
      fxRateTolerance < 0 ||
      fxRateTolerance > 1)
  ) {
    throw new Error(
      "reconciliation.fxRateTolerance must be a number from 0 to 1.",
    );
  }
  return {
    duplicateWindowDays,
    transferWindowDays,
    fxRateTolerance,
  } satisfies IngestionReconciliationConfig;
}

function stateDefaults(): IngestionState {
  return {
    version: STATE_VERSION,
    cursors: {},
    syncState: {},
    seenImportIds: [],
    seenFingerprints: [],
    seenProviderImportIds: [],
  };
}

export function validateBrandfetchConfig(
  value: BrandfetchEnrichmentConfig | undefined,
  countryCode?: string,
) {
  if (!value) return undefined;
  if (typeof value.enabled !== "boolean")
    throw new Error("brandfetch.enabled must be a boolean.");
  if (
    value.clientId?.startsWith("env:") &&
    !value.clientId.slice("env:".length).trim()
  ) {
    throw new Error(
      "Brandfetch client ID env: references need a variable name.",
    );
  }
  // Kept for compatibility with callers that still pass a country hint.
  void countryCode;
  const legacy = value as BrandfetchEnrichmentConfig & {
    assetMode?: unknown;
    ttlDays?: unknown;
  };
  const delivery =
    legacy.delivery === "local-cache" || legacy.delivery === "server-proxy"
      ? legacy.delivery
      : legacy.assetMode === "hotlink"
        ? "server-proxy"
        : "local-cache";
  const refreshDays =
    legacy.refreshDays ??
    (typeof legacy.ttlDays === "number" ? legacy.ttlDays : 30);
  if (!Number.isInteger(refreshDays) || refreshDays < 1 || refreshDays > 365) {
    throw new Error(
      "brandfetch.refreshDays must be a whole number from 1 to 365.",
    );
  }
  if (
    value.highResolution !== undefined &&
    typeof value.highResolution !== "boolean"
  ) {
    throw new Error("brandfetch.highResolution must be a boolean.");
  }
  return {
    enabled: value.enabled,
    clientId: value.clientId?.trim() || undefined,
    delivery,
    refreshDays,
    highResolution: value.highResolution === true,
  } satisfies BrandfetchEnrichmentConfig;
}

function validateMerchantEnrichment(
  value: MerchantEnrichmentConfig | undefined,
) {
  if (!value) return undefined;
  if (typeof value.enabled !== "boolean")
    throw new Error("merchantEnrichment.enabled must be a boolean.");
  const countryCode = value.countryCode?.trim().toUpperCase();
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode))
    throw new Error(
      "merchantEnrichment.countryCode must be an ISO alpha-2 code.",
    );
  // Brandfetch is global; ignore any nested copy on write.
  return {
    enabled: value.enabled,
    aiEnabled: value.aiEnabled,
    countryCode,
  } satisfies MerchantEnrichmentConfig;
}

/** True when the source is a registered connector (not legacy json-api). */
export function isConnectorIngestionSource(
  source: Pick<IngestionSourceDefinition, "kind">,
) {
  ensureConnectorsRegistered();
  return source.kind !== "json-api" && hasConnector(source.kind);
}

/** Grouped multi-account connections (connector capability or legacy accounts[]). */
export function isGroupedIngestionSource(
  source: IngestionSourceDefinition,
): boolean {
  ensureConnectorsRegistered();
  if (isConnectorIngestionSource(source)) {
    return (
      getConnector(source.kind)?.capabilities.groupedAccounts === true ||
      Array.isArray(source.accounts)
    );
  }
  return isGroupedJsonApiSource(source);
}

export function sourceSecretRef(
  source: IngestionSourceDefinition,
): string | undefined {
  if (isConnectorIngestionSource(source)) {
    const config = source.config as { secretRef?: unknown } | undefined;
    return typeof config?.secretRef === "string" ? config.secretRef : undefined;
  }
  return source.api?.secretRef;
}

function validateHttpsUrl(
  value: string,
  allowedHosts: readonly string[] | undefined,
  label: string,
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  const isLocalHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1");
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error(
      `${label} must use HTTPS (HTTP is allowed only for localhost).`,
    );
  }
  const hosts = allowedHosts
    ?.map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (hosts?.length && !hosts.includes(url.hostname.toLowerCase())) {
    throw new Error(`${label} is not in this source's allowlist.`);
  }
  return { url, allowedHosts: hosts };
}

function validateLinkedAccount(account: JsonApiLinkedAccount, index: number) {
  if (!account.id?.trim()) {
    throw new Error(`Linked account ${index + 1} needs an id.`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(account.id)) {
    throw new Error(
      `Linked account ${index + 1} id may use only letters, numbers, hyphens, and underscores.`,
    );
  }
  if (!account.name?.trim()) {
    throw new Error(`Linked account ${index + 1} needs a name.`);
  }
  if (!account.sourceAccount?.trim()) {
    throw new Error(`Linked account ${index + 1} needs a source account.`);
  }
  if (
    account.reconciliationPriority !== undefined &&
    (!Number.isInteger(account.reconciliationPriority) ||
      account.reconciliationPriority < -100 ||
      account.reconciliationPriority > 100)
  ) {
    throw new Error(
      `Linked account ${index + 1} reconciliation priority must be an integer from -100 to 100.`,
    );
  }
  return {
    id: account.id.trim(),
    name: account.name.trim(),
    sourceAccount: account.sourceAccount.trim(),
    defaultCurrency: account.defaultCurrency?.trim() || undefined,
    reconciliationPriority: account.reconciliationPriority,
  } satisfies JsonApiLinkedAccount;
}

function validateConnectorSource(
  source: IngestionSourceDefinition,
): IngestionSourceDefinition {
  ensureConnectorsRegistered();
  const connector = requireConnector(source.kind);
  const config = connector.validateConfig(source.config ?? {});
  let accounts: JsonApiLinkedAccount[] | undefined;
  let sourceAccount: string | undefined;
  if (connector.capabilities.groupedAccounts) {
    accounts = (source.accounts ?? []).map(validateLinkedAccount);
    const accountIds = new Set(accounts.map((account) => account.id));
    if (accountIds.size !== accounts.length) {
      throw new Error("Linked account identifiers must be unique.");
    }
    sourceAccount = undefined;
  } else {
    if (!source.sourceAccount?.trim()) {
      throw new Error("A source account is required.");
    }
    sourceAccount = source.sourceAccount.trim();
    accounts = undefined;
  }
  return {
    id: source.id,
    name: source.name.trim(),
    kind: source.kind,
    merchantId: source.merchantId?.trim() || undefined,
    sourceAccount,
    accounts,
    destinationPath: source.destinationPath?.trim() || undefined,
    defaultCurrency: source.defaultCurrency?.trim() || undefined,
    reconciliationPriority: source.reconciliationPriority,
    allowedAccountRoots: source.allowedAccountRoots?.filter(Boolean),
    aiEnabled: source.aiEnabled,
    setup: source.setup?.trim() || connector.setupMarkdown || undefined,
    merchantEnrichment: validateMerchantEnrichment(source.merchantEnrichment),
    config,
    rules: source.rules ?? [],
  };
}

function validateJsonApiSource(
  source: IngestionSourceDefinition,
): IngestionSourceDefinition {
  if (!source.api?.secretRef?.trim()) {
    throw new Error("JSON API sources need an API key (or env: reference).");
  }
  if (
    source.api.secretRef.startsWith("env:") &&
    !source.api.secretRef.slice("env:".length).trim()
  ) {
    throw new Error("Environment credential references need a variable name.");
  }
  if (!source.mapping?.date || !source.mapping.amount) {
    throw new Error("JSON API mappings need date and amount paths.");
  }

  const grouped = isGroupedJsonApiSource(source);
  let allowedHosts: string[] | undefined;
  let api: JsonApiSourceConfig;
  let accounts: JsonApiLinkedAccount[] | undefined;
  let sourceAccount: string | undefined;

  if (grouped) {
    if (!source.api.baseUrl?.trim()) {
      throw new Error(
        "Grouped JSON API sources need an api.baseUrl (for example https://lunchflow.app/api/v1).",
      );
    }
    const validated = validateHttpsUrl(
      source.api.baseUrl,
      source.api.allowedHosts,
      "JSON API base URL",
    );
    allowedHosts = validated.allowedHosts;
    accounts = (source.accounts ?? []).map(validateLinkedAccount);
    const accountIds = new Set(accounts.map((account) => account.id));
    if (accountIds.size !== accounts.length) {
      throw new Error("Linked account identifiers must be unique.");
    }
    api = {
      ...source.api,
      baseUrl: source.api.baseUrl.replace(/\/+$/, ""),
      endpoint: undefined,
      allowedHosts,
    };
    sourceAccount = undefined;
  } else {
    if (!source.sourceAccount?.trim()) {
      throw new Error("A source account is required.");
    }
    if (!source.api.endpoint?.trim()) {
      throw new Error(
        "JSON API sources need an endpoint and an API key (or env: reference).",
      );
    }
    const validated = validateHttpsUrl(
      source.api.endpoint,
      source.api.allowedHosts,
      "JSON API endpoint",
    );
    allowedHosts = validated.allowedHosts;
    api = { ...source.api, allowedHosts };
    sourceAccount = source.sourceAccount.trim();
    accounts = undefined;
  }

  return {
    ...source,
    kind: "json-api",
    merchantId: source.merchantId?.trim() || undefined,
    reconciliationPriority: source.reconciliationPriority,
    sourceAccount,
    accounts,
    setup: source.setup?.trim() || undefined,
    api,
    mapping: source.mapping,
    config: undefined,
    rules: source.rules ?? [],
    allowedAccountRoots: source.allowedAccountRoots?.filter(Boolean),
    merchantEnrichment: validateMerchantEnrichment(source.merchantEnrichment),
  };
}

function validateSource(
  source: IngestionSourceDefinition,
): IngestionSourceDefinition {
  sourceId(source.id);
  if (!source.name.trim()) throw new Error("An ingestion source needs a name.");
  if (
    source.merchantId !== undefined &&
    typeof source.merchantId !== "string"
  ) {
    throw new Error("A connection merchant id must be text.");
  }
  if (source.setup !== undefined && typeof source.setup !== "string") {
    throw new Error("Source setup must be markdown text.");
  }
  if (
    source.reconciliationPriority !== undefined &&
    (!Number.isInteger(source.reconciliationPriority) ||
      source.reconciliationPriority < -100 ||
      source.reconciliationPriority > 100)
  ) {
    throw new Error(
      "A connection reconciliation priority must be an integer from -100 to 100.",
    );
  }
  ensureConnectorsRegistered();
  if (source.kind !== "json-api" && hasConnector(source.kind)) {
    return validateConnectorSource(source);
  }
  if (source.kind !== "json-api") {
    throw new Error(`Unsupported ingestion source kind: ${source.kind}`);
  }
  return validateJsonApiSource(source);
}

export type FilesystemIngestionStoreOptions = {
  resolveProjectRoot: ProjectRootResolver;
};

/** Local persistence for configurations and actionable, normalized runs. */
export class FilesystemIngestionStore {
  readonly merchants: FilesystemMerchantStore;
  readonly logos: BrandfetchLogoService;
  private readonly resolveProjectRoot: ProjectRootResolver;
  private readonly runs: FilesystemIngestionRunArchive;

  constructor(options: FilesystemIngestionStoreOptions) {
    this.resolveProjectRoot = options.resolveProjectRoot;
    this.merchants = new FilesystemMerchantStore(options.resolveProjectRoot);
    this.logos = new BrandfetchLogoService(this.merchants);
    this.runs = new FilesystemIngestionRunArchive(options.resolveProjectRoot);
  }

  async projectRoot(project: string) {
    return this.resolveProjectRoot(projectId(project));
  }

  private async path(project: string, name: string) {
    const root = await this.projectRoot(project);
    return join(projectIngestionRoot(root), name);
  }

  private async write(path: string, value: unknown) {
    await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(value, null, 2) + "\n", {
      mode: 0o600,
    });
    await fs.chmod(temporary, 0o600);
    await fs.rename(temporary, path);
  }

  async readConfig(project: string) {
    const raw = await readJson(
      await this.path(project, "sources.json"),
      configDefaults(),
    );
    const migrated = migrateIngestionConfig(raw);
    return {
      ...migrated,
      brandfetch: validateBrandfetchConfig(migrated.brandfetch),
    } satisfies IngestionConfig;
  }

  async writeConfig(project: string, config: IngestionConfig) {
    ensureConnectorsRegistered();
    const migrated = migrateIngestionConfig(config);
    const sources = migrated.sources.map(validateSource);
    if (new Set(sources.map((source) => source.id)).size !== sources.length) {
      throw new Error("Ingestion source identifiers must be unique.");
    }
    const countryHint = sources
      .map((source) => source.merchantEnrichment?.countryCode)
      .find((code) => !!code);
    const brandfetch = validateBrandfetchConfig(
      migrated.brandfetch ?? config.brandfetch,
      countryHint,
    );
    const reconciliation = validateReconciliationConfig(
      migrated.reconciliation ?? config.reconciliation,
    );
    await this.write(await this.path(project, "sources.json"), {
      version: VERSION,
      brandfetch,
      reconciliation,
      sources,
    });
  }

  private async readPersistedState(project: string) {
    const raw = await readJson(
      await this.path(project, "state.json"),
      stateDefaults(),
    );
    return parseIngestionState(raw);
  }

  private async writeState(project: string, state: IngestionState) {
    await this.write(await this.path(project, "state.json"), {
      ...state,
      version: STATE_VERSION,
    } satisfies IngestionState);
  }

  async readState(project: string) {
    return this.readPersistedState(project);
  }

  async readRuns(project: string) {
    return this.runs.readAll(project);
  }

  async listRuns(
    project: string,
    options: { limit?: number; offset?: number; sourceId?: string } = {},
  ): Promise<IngestionRunPage> {
    return this.runs.list(project, options);
  }

  async source(project: string, id: string) {
    const config = await this.readConfig(project);
    const source = config.sources.find((item) => item.id === id);
    if (!source) throw new Error(`Unknown ingestion source: ${id}`);
    return source;
  }

  /** Discover accounts through a persisted connector or grouped JSON source. */
  async discoverAccounts(
    project: string,
    sourceId: string,
    options?: { fetch?: typeof globalThis.fetch; signal?: AbortSignal },
  ): Promise<DiscoveredJsonApiAccount[]> {
    const source = await this.source(project, sourceId);
    const projectRoot = await this.projectRoot(project);
    const env = await resolveProjectEnv(projectRoot);
    const resolveSecret = async (reference: string) =>
      resolveEnvSecret(reference, env);

    if (isConnectorIngestionSource(source)) {
      const connector = requireConnector(source.kind);
      if (
        !connector.capabilities.discoverAccounts ||
        !connector.discoverAccounts
      ) {
        throw new Error(
          `${connector.name} does not support account discovery.`,
        );
      }
      const config = connector.validateConfig(source.config ?? {});
      return connector.discoverAccounts(config, {
        sourceId: source.id,
        resolveSecret,
        fetch: options?.fetch,
        signal: options?.signal,
      });
    }

    if (!isGroupedJsonApiSource(source) || !source.api?.baseUrl) {
      throw new Error(
        `Source ${source.id} does not support account discovery.`,
      );
    }
    return discoverJsonApiAccounts({
      baseUrl: source.api.baseUrl,
      secretRef: source.api.secretRef,
      authScheme: source.api.authScheme,
      allowedHosts: source.api.allowedHosts,
      resolveSecret,
      fetch: options?.fetch,
      signal: options?.signal,
    });
  }

  /** Resolve a connection id from a run's sourceId (`connection` or `connection:account`). */
  async sourceForRunSourceId(project: string, runSourceId: string) {
    const config = await this.readConfig(project);
    const exact = config.sources.find((item) => item.id === runSourceId);
    if (exact) return exact;
    const separator = runSourceId.indexOf(":");
    if (separator > 0) {
      const connectionId = runSourceId.slice(0, separator);
      const grouped = config.sources.find((item) => item.id === connectionId);
      if (grouped) return grouped;
    }
    throw new Error(`Unknown ingestion source: ${runSourceId}`);
  }

  async saveRun(
    project: string,
    run: IngestionRun,
    options?: { syncState?: ConnectorSyncState },
  ) {
    const state = await this.readState(project);
    const config = await this.readConfig(project);
    const source = config.sources.find(
      (item) =>
        item.id === run.sourceId || run.sourceId.startsWith(`${item.id}:`),
    );
    const providerIds =
      !source || source.kind === "json-api"
        ? []
        : run.proposals.flatMap((proposal) =>
            proposal.transaction
              ? [providerImportIdentity(source.kind, proposal.transaction)]
              : [],
          );
    const next = {
      ...state,
      cursors: { ...state.cursors, [run.sourceId]: run.cursor },
      syncState: options?.syncState
        ? { ...state.syncState, [run.sourceId]: options.syncState }
        : state.syncState,
      seenImportIds: [
        ...new Set([
          ...state.seenImportIds,
          ...run.proposals
            .filter((proposal) => proposal.status !== "invalid")
            .map((proposal) => proposal.importId),
        ]),
      ].slice(-SEEN_LIMIT),
      seenFingerprints: [
        ...new Set([
          ...state.seenFingerprints,
          ...run.proposals.flatMap((proposal) =>
            proposal.transaction
              ? [transactionFingerprint(proposal.transaction)]
              : [],
          ),
        ]),
      ].slice(-SEEN_LIMIT),
      seenProviderImportIds: [
        ...new Set([
          ...state.seenProviderImportIds,
          ...providerIds.filter((id): id is string => Boolean(id)),
        ]),
      ].slice(-SEEN_LIMIT),
    } satisfies IngestionState;
    await this.runs.write(project, run);
    await this.writeState(project, next);
    return run;
  }

  async run(project: string, runId: string) {
    return this.runs.read(project, runId);
  }

  private async syncJobPath(project: string, jobId: string) {
    return this.path(project, join("sync-jobs", `${jobId}.json`));
  }

  private async syncJobsDirectory(project: string) {
    return this.path(project, "sync-jobs");
  }

  async saveSyncJob(project: string, job: IngestionSyncJob) {
    await this.write(await this.syncJobPath(project, job.id), job);
    return job;
  }

  async readSyncJob(project: string, jobId: string) {
    try {
      return JSON.parse(
        await fs.readFile(await this.syncJobPath(project, jobId), "utf8"),
      ) as IngestionSyncJob;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Unknown sync job: ${jobId}`);
      }
      throw error;
    }
  }

  async listSyncJobs(project: string) {
    const directory = await this.syncJobsDirectory(project);
    let names: string[];
    try {
      names = await fs.readdir(directory);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const jobs: IngestionSyncJob[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      try {
        jobs.push(
          JSON.parse(
            await fs.readFile(join(directory, name), "utf8"),
          ) as IngestionSyncJob,
        );
      } catch {
        // Ignore corrupt job files.
      }
    }
    return jobs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async findActiveSyncJob(project: string, sourceId: string) {
    const jobs = await this.listSyncJobs(project);
    return (
      jobs.find(
        (job) =>
          job.sourceId === sourceId &&
          (job.status === "queued" || job.status === "running"),
      ) ?? null
    );
  }

  async latestSyncJob(project: string, sourceId?: string) {
    const jobs = await this.listSyncJobs(project);
    if (!sourceId) return jobs[0] ?? null;
    return jobs.find((job) => job.sourceId === sourceId) ?? null;
  }

  /** Mark in-flight jobs as failed after a process restart. */
  async failInterruptedSyncJobs(project: string) {
    const jobs = await this.listSyncJobs(project);
    const interrupted = jobs.filter(
      (job) => job.status === "queued" || job.status === "running",
    );
    for (const job of interrupted) {
      await this.saveSyncJob(project, {
        ...job,
        status: "failed",
        completedAt: new Date().toISOString(),
        error: "Sync interrupted because the server restarted.",
        progress: {
          ...job.progress,
          stage: "complete",
          message: "Sync interrupted because the server restarted.",
        },
      });
    }
    return interrupted.length;
  }

  async updateProposal(
    project: string,
    runId: string,
    proposalId: string,
    account: string,
  ) {
    return this.patchProposal(project, runId, proposalId, { account });
  }

  async patchProposal(
    project: string,
    runId: string,
    proposalId: string,
    patch: {
      account?: string;
      /** Move between ready and needs-review without changing the selected account. */
      status?: "ready" | "needs-review";
      transaction?: NormalizedTransactionPatch;
    },
  ) {
    const run = await this.run(project, runId);
    const proposals = run.proposals.map((proposal) => {
      if (proposal.id !== proposalId) return proposal;
      if (
        !proposal.transaction ||
        proposal.status === "duplicate" ||
        proposal.status === "invalid" ||
        proposal.status === "accepted" ||
        proposal.status === "held"
      ) {
        throw new Error("This proposal cannot be edited.");
      }

      let next = { ...proposal, transaction: { ...proposal.transaction } };
      if (patch.transaction) {
        const tx = patch.transaction;
        if (tx.bookedAt !== undefined) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(tx.bookedAt)) {
            throw new Error(
              "bookedAt must be an ISO calendar date (YYYY-MM-DD).",
            );
          }
          next.transaction!.bookedAt = tx.bookedAt;
        }
        if (tx.amount !== undefined) {
          if (!/^-?\d+(\.\d+)?$/.test(tx.amount.trim())) {
            throw new Error("amount must be a decimal number.");
          }
          next.transaction!.amount = tx.amount.trim();
        }
        if (tx.currency !== undefined) {
          next.transaction!.currency = tx.currency.trim().toUpperCase();
        }
        if (tx.merchant !== undefined) {
          next.transaction!.merchant = tx.merchant.trim() || undefined;
        }
        if (tx.payee !== undefined) {
          next.transaction!.payee = tx.payee.trim() || undefined;
        }
        if (tx.narration !== undefined) {
          next.transaction!.narration = tx.narration;
        }
        if (tx.tags !== undefined) {
          next.transaction!.tags = [...tx.tags]
            .map((tag) => tag.trim())
            .filter(Boolean);
        }
        if (tx.links !== undefined) {
          next.transaction!.links = [...tx.links]
            .map((link) => link.trim())
            .filter(Boolean);
        }
        if (tx.metadata !== undefined) {
          const metadata: Record<string, string> = {};
          for (const [key, value] of Object.entries(tx.metadata)) {
            const cleanKey = key.trim();
            if (!cleanKey) continue;
            metadata[cleanKey] = String(value);
          }
          next.transaction!.metadata = metadata;
        }
      }

      if (patch.account !== undefined) {
        const account = patch.account;
        const suggestions = [
          ...next.suggestions.filter((item) => item.method !== "manual"),
          {
            account,
            rawScore: 1,
            scoreKind: "manual" as const,
            support: 1,
            hard: true,
            method: "manual" as const,
            explanation: `Manually categorised as ${account}.`,
            evidence: [
              {
                id: `manual:${next.id}:${account}`,
                kind: "manual" as const,
                summary: "Manual account selection",
              },
            ],
          },
        ];
        next = {
          ...next,
          selectedAccount: account,
          suggestions,
          status: "ready",
        };
      }

      if (patch.status !== undefined) {
        if (patch.status === "ready" && !next.selectedAccount) {
          throw new Error("Select an account before marking a proposal ready.");
        }
        if (patch.status !== "ready" && patch.status !== "needs-review") {
          throw new Error("Unsupported proposal status update.");
        }
        next = { ...next, status: patch.status };
      }

      return next;
    });
    const updated = { ...run, proposals, summary: summarize(proposals) };
    await this.runs.write(project, updated);
    return updated;
  }

  async proposal(project: string, runId: string, proposalId: string) {
    const run = await this.run(project, runId);
    const proposal = run.proposals.find((item) => item.id === proposalId);
    if (!proposal) throw new Error(`Unknown ingestion proposal: ${proposalId}`);
    return proposal;
  }

  async replaceProposal(
    project: string,
    runId: string,
    proposal: ImportProposal,
  ) {
    const [run] = await this.replaceProposals(project, [{ runId, proposal }]);
    return run!;
  }

  /** Replace many proposals across archived runs in one batch. */
  async replaceProposals(
    project: string,
    updates: readonly { runId: string; proposal: ImportProposal }[],
  ) {
    if (!updates.length) return [] as IngestionRun[];
    const runs = await this.runs.readAll(project);
    const byRun = new Map<string, Map<string, ImportProposal>>();
    for (const update of updates) {
      const map = byRun.get(update.runId) ?? new Map();
      map.set(update.proposal.id, update.proposal);
      byRun.set(update.runId, map);
    }
    const touched: IngestionRun[] = [];
    for (const run of runs) {
      const map = byRun.get(run.id);
      if (!map) continue;
      for (const proposalId of map.keys()) {
        if (!run.proposals.some((item) => item.id === proposalId)) {
          throw new Error(`Unknown ingestion proposal: ${proposalId}`);
        }
      }
      const proposals = run.proposals.map((item) => map.get(item.id) ?? item);
      const complete = {
        ...run,
        proposals,
        summary: summarize(proposals),
      } satisfies IngestionRun;
      touched.push(complete);
    }
    for (const runId of byRun.keys()) {
      if (!runs.some((run) => run.id === runId)) {
        throw new Error(`Unknown ingestion run: ${runId}`);
      }
    }
    await this.runs.writeMany(project, touched);
    return touched;
  }

  async writeRuns(project: string, runs: readonly IngestionRun[]) {
    const existing = await this.runs.readAll(project);
    const byId = new Map(existing.map((run) => [run.id, run]));
    for (const run of runs) {
      if (!byId.has(run.id)) {
        throw new Error(`Unknown ingestion run: ${run.id}`);
      }
    }
    const complete = runs.map(
      (run) =>
        ({ ...run, summary: summarize(run.proposals) }) satisfies IngestionRun,
    );
    await this.runs.writeMany(project, complete);
    return complete;
  }

  async markAccepted(
    project: string,
    runId: string,
    acceptedProposals: readonly Pick<
      ImportProposal,
      "id" | "merchantResolution"
    >[],
    acceptance: ProposalAcceptance,
  ) {
    const run = await this.run(project, runId);
    const accepted = new Map(
      acceptedProposals.map((proposal) => [proposal.id, proposal]),
    );
    const known = new Set(run.proposals.map((proposal) => proposal.id));
    for (const proposal of acceptedProposals) {
      if (!known.has(proposal.id)) {
        throw new Error(`Unknown ingestion proposal: ${proposal.id}`);
      }
    }
    const proposals = run.proposals.map((proposal) => {
      const persisted = accepted.get(proposal.id);
      if (!persisted) return proposal;
      if (proposal.status === "accepted") return proposal;
      return {
        ...proposal,
        merchantResolution:
          persisted.merchantResolution ?? proposal.merchantResolution,
        status: "accepted" as const,
        acceptance,
        duplicateOf: undefined,
      } satisfies ImportProposal;
    });
    const updated = { ...run, proposals, summary: summarize(proposals) };
    await this.runs.write(project, updated);
    return updated;
  }
}

function summarize(proposals: readonly ImportProposal[]) {
  return summarizeIngestionProposals(proposals);
}

/** Returns the only accounts that a source may suggest or accept manually. */
export function categoryAccountsForSource(
  source: IngestionSourceDefinition,
  accounts: readonly string[],
) {
  const linkedSourceAccounts = isGroupedIngestionSource(source)
    ? (source.accounts ?? []).map((account) => account.sourceAccount)
    : source.sourceAccount
      ? [source.sourceAccount]
      : [];
  const excluded = new Set(linkedSourceAccounts);
  const scoped = source.allowedAccountRoots?.length
    ? accounts.filter((account) =>
        source.allowedAccountRoots!.some(
          (root) => account === root || account.startsWith(`${root}:`),
        ),
      )
    : accounts;
  return [...new Set(scoped)]
    .filter((account) => account && !excluded.has(account))
    .sort();
}

export type ExpandedIngestionTarget = {
  sourceId: string;
  sourceAccount: string;
  defaultCurrency?: string;
  accountId?: string;
  /** Present for legacy json-api targets. */
  api?: JsonApiSourceConfig;
};

/** Expand a standalone or grouped source into concrete fetch targets. */
export function expandIngestionSource(
  source: IngestionSourceDefinition,
  options?: { accountId?: string },
): ExpandedIngestionTarget[] {
  ensureConnectorsRegistered();
  if (isConnectorIngestionSource(source)) {
    const connector = requireConnector(source.kind);
    return connector.expandTargets(
      {
        ...(source as ConnectorSourceDefinition),
        config: source.config,
        rules: source.rules ?? [],
      } as ConnectorSourceDefinition,
      options,
    );
  }

  if (!source.api) {
    throw new Error(`Source ${source.id} is missing JSON API configuration.`);
  }

  if (isGroupedJsonApiSource(source)) {
    const baseUrl = source.api.baseUrl?.trim();
    if (!baseUrl) {
      throw new Error("Grouped JSON API sources need an api.baseUrl.");
    }
    const linked = source.accounts ?? [];
    const selected = options?.accountId
      ? linked.filter((account) => account.id === options.accountId)
      : linked;
    if (options?.accountId && !selected.length) {
      throw new Error(
        `Unknown linked account ${options.accountId} on source ${source.id}.`,
      );
    }
    if (!selected.length) {
      throw new Error(`Source ${source.id} has no linked accounts to ingest.`);
    }
    return selected.map((account) => ({
      sourceId: jsonApiAccountSourceId(source.id, account.id),
      sourceAccount: account.sourceAccount,
      defaultCurrency: account.defaultCurrency ?? source.defaultCurrency,
      accountId: account.id,
      api: {
        ...source.api!,
        endpoint: jsonApiAccountTransactionsEndpoint(baseUrl, account.id),
      },
    }));
  }

  if (!source.sourceAccount?.trim() || !source.api.endpoint?.trim()) {
    throw new Error(
      `Source ${source.id} needs a sourceAccount and api.endpoint.`,
    );
  }
  return [
    {
      sourceId: source.id,
      sourceAccount: source.sourceAccount,
      defaultCurrency: source.defaultCurrency,
      api: source.api as JsonApiSourceConfig & { endpoint: string },
    },
  ];
}

/** Discover remote accounts for a grouped provider connection. */
export async function discoverIngestionAccounts(options: {
  baseUrl: string;
  secretRef: string;
  authScheme?: "bearer" | "x-api-key";
  allowedHosts?: readonly string[];
  accountsPath?: string;
  /** Project root used to overlay `{root}/.env` onto process.env for `env:` refs. */
  projectRoot?: string;
}): Promise<DiscoveredJsonApiAccount[]> {
  validateHttpsUrl(options.baseUrl, options.allowedHosts, "JSON API base URL");
  const env = await resolveProjectEnv(options.projectRoot);
  return discoverJsonApiAccounts({
    ...options,
    resolveSecret: async (reference) => resolveEnvSecret(reference, env),
  });
}

/** Resolve the Brandfetch Logo API client ID without persisting its value. */
export async function resolveBrandfetchRuntime(
  brandfetch: BrandfetchEnrichmentConfig | undefined,
  projectRoot?: string,
) {
  if (!brandfetch) return undefined;
  const env = await resolveProjectEnv(projectRoot);
  return {
    clientId: resolveEnvSecret(brandfetch.clientId, env),
    env,
  };
}

function enrichmentWithResolvedClientId(
  enrichment: MerchantEnrichmentConfig,
  clientId: string | undefined,
): MerchantEnrichmentConfig {
  if (!enrichment.brandfetch) return enrichment;
  return {
    ...enrichment,
    brandfetch: {
      ...enrichment.brandfetch,
      clientId,
    },
  };
}

function safeCodexEnvironment() {
  const env = process.env;
  return Object.fromEntries(
    ["PATH", "HOME", "USER", "TMPDIR", "CODEX_HOME", "LANG", "LC_ALL"].flatMap(
      (key) => (env[key] === undefined ? [] : [[key, env[key]!]]),
    ),
  );
}

async function runCodex(args: readonly string[], timeoutMs: number) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("codex", args, {
      env: safeCodexEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || "Codex categorizer failed."));
    });
  });
}

/** Shared `codex exec` argv for structured ingestion AI calls (CLI ≥ 0.137). */
function codexExecArgs(options: {
  directory: string;
  schemaPath: string;
  model?: string;
  prompt: string;
}) {
  return [
    "exec",
    "--ephemeral",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--ignore-user-config",
    "--ignore-rules",
    "--cd",
    options.directory,
    "--output-schema",
    options.schemaPath,
    "-c",
    'web_search="disabled"',
    "-c",
    "features.shell_tool=false",
    "-c",
    "features.apps=false",
    "-c",
    "features.multi_agent=false",
    ...(options.model ? ["--model", options.model] : []),
    options.prompt,
  ];
}

type CodexResult = {
  account: string;
  rawScore: number;
  evidenceIds: string[];
};

/** Prompt/response capture from a single AI enrichment call (debug UI). */
export type AiEnrichmentDebugCall = AiEnrichmentCallRecord;

export type { AiEnrichmentCallRecord, AiEnrichmentSnapshot };

export type AiEnrichmentDebug = {
  calls: AiEnrichmentCallRecord[];
};

function prettyJson(value: unknown) {
  try {
    if (typeof value === "string") {
      return JSON.stringify(JSON.parse(value), null, 2);
    }
    return JSON.stringify(value, null, 2);
  } catch {
    return typeof value === "string" ? value : String(value);
  }
}

type CodexPluginOptions = {
  model?: string;
  timeoutMs?: number;
  onDebug?: (call: AiEnrichmentDebugCall) => void;
};

/** Optional, structured Codex categorizer. It receives a bounded transaction and evidence summary only. */
export class CodexCategorizer implements CategorizerPlugin {
  readonly id = "codex-ai";
  readonly isAi = true;

  constructor(readonly options: CodexPluginOptions = {}) {}

  async suggest(
    context: CategorizationContext,
  ): Promise<readonly CategorySuggestion[]> {
    const directory = await fs.mkdtemp(
      join(tmpdir(), "beancount-js-categorizer-"),
    );
    const schemaPath = join(directory, "schema.json");
    const schema = {
      type: "object",
      properties: {
        account: { type: "string" },
        rawScore: { type: "number", minimum: 0, maximum: 1 },
        evidenceIds: { type: "array", items: { type: "string" } },
      },
      required: ["account", "rawScore", "evidenceIds"],
      additionalProperties: false,
    };
    let promptPayload: unknown;
    let response: string | undefined;
    let failure: string | undefined;
    try {
      await fs.writeFile(schemaPath, JSON.stringify(schema), { mode: 0o600 });
      const evidence =
        context.priorSuggestions?.flatMap(
          (suggestion) => suggestion.evidence,
        ) ?? [];
      promptPayload = {
        task: "Categorise one imported Beancount transaction. Choose only from availableAccounts. Use only supplied evidence IDs. Return the JSON schema response and no prose.",
        transaction: context.transaction,
        availableAccounts: context.availableAccounts,
        evidence: evidence.map((item) => ({
          id: item.id,
          summary: item.summary,
          occurrences: item.occurrences,
        })),
      };
      const prompt = JSON.stringify(promptPayload);
      response = await runCodex(
        codexExecArgs({
          directory,
          schemaPath,
          model: this.options.model,
          prompt,
        }),
        this.options.timeoutMs ?? 60_000,
      );
      const result = JSON.parse(response) as CodexResult;
      if (
        !result ||
        typeof result.account !== "string" ||
        typeof result.rawScore !== "number" ||
        !Array.isArray(result.evidenceIds) ||
        !context.availableAccounts.includes(result.account)
      ) {
        throw new Error("Codex returned an invalid category suggestion.");
      }
      const evidenceById = new Map(evidence.map((item) => [item.id, item]));
      if (result.evidenceIds.some((id) => !evidenceById.has(id))) {
        throw new Error("Codex referred to evidence that was not provided.");
      }
      const matchedEvidence = result.evidenceIds
        .map((id) => evidenceById.get(id)!)
        .filter(Boolean) as CategoryEvidence[];
      return [
        {
          account: result.account,
          rawScore: Math.min(
            Math.max(result.rawScore, 0),
            matchedEvidence.length ? 1 : 0.8,
          ),
          scoreKind: "ai-advisory",
          support: matchedEvidence.length,
          method: "ai",
          explanation: matchedEvidence.length
            ? `AI suggested ${result.account}, supported by the displayed ledger evidence.`
            : `AI suggested ${result.account}; review before accepting.`,
          evidence: matchedEvidence,
        },
      ];
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      if (promptPayload !== undefined) {
        this.options.onDebug?.({
          id: this.id,
          label: "AI categoriser",
          prompt: prettyJson(promptPayload),
          response: response ? prettyJson(response) : undefined,
          error: failure,
          ok: !failure,
          at: nowIso(),
        });
      }
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
}

function transactionMerchantLabel(transaction: ImportProposal["transaction"]) {
  return transaction?.merchant ?? transaction?.payee ?? transaction?.narration;
}

/** Remove long terminal/store identifiers before an advisory model sees a label. */
export function merchantAdvisorLabel(rawLabel: string) {
  return normalizeMerchant(rawLabel)
    .replace(/\b\d{3,}\b/g, "#")
    .trim();
}

export function merchantLogoUrlFor(
  project: string,
  merchant: {
    merchantId: string;
    domain?: string;
    brand?: { asset?: { sha256: string; expiresAt: string } };
  },
  enrichment: MerchantEnrichmentConfig,
) {
  const asset = merchant.brand?.asset;
  const clientId = enrichment.brandfetch?.clientId;
  // An internal URL keeps the Logo API client ID out of every browser payload.
  if (
    !asset &&
    (!merchant.domain || !clientId || clientId.startsWith("env:"))
  ) {
    return undefined;
  }
  const base = `/api/projects/${encodeURIComponent(project)}/ingestion/merchants/${encodeURIComponent(merchant.merchantId)}/logo`;
  return asset ? `${base}?v=${encodeURIComponent(asset.sha256)}` : base;
}

/** Internal app URL for an unpersisted Brand Match candidate. */
export function brandfetchDomainLogoUrl(project: string, domain: string) {
  if (!isValidDomain(domain)) return undefined;
  return `/api/projects/${encodeURIComponent(project)}/ingestion/logos/${encodeURIComponent(domain.toLowerCase())}`;
}

class ProfileMerchantResolver implements MerchantResolverPlugin {
  readonly id = "merchant-profiles";

  constructor(
    private readonly store: FilesystemMerchantStore,
    private readonly project: string,
    private readonly enrichment: MerchantEnrichmentConfig,
  ) {}

  async resolve(context: Parameters<MerchantResolverPlugin["resolve"]>[0]) {
    const rawLabel = transactionMerchantLabel(context.transaction);
    if (!rawLabel) return undefined;
    const resolution = await this.store.resolve(
      this.project,
      context.transaction.sourceId,
      rawLabel,
    );
    if (resolution?.status !== "confirmed") return resolution;
    return {
      ...resolution,
      merchant: {
        ...resolution.merchant,
        logoUrl: merchantLogoUrlFor(
          this.project,
          resolution.merchant,
          this.enrichment,
        ),
      },
    } satisfies MerchantResolution;
  }
}

function domainInMerchantLabel(rawLabel: string) {
  const tokens = rawLabel.toLowerCase().match(/[a-z0-9][a-z0-9.-]*/g) ?? [];
  return tokens
    .map((token) => token.replace(/^www\./, "").replace(/\.$/, ""))
    .find((token) => isValidDomain(token));
}

/** Matches a known, confirmed domain without ever merging on merchant name. */
class ExistingDomainMerchantResolver implements MerchantResolverPlugin {
  readonly id = "merchant-domains";

  constructor(
    private readonly store: FilesystemMerchantStore,
    private readonly project: string,
    private readonly enrichment: MerchantEnrichmentConfig,
  ) {}

  async resolve(context: Parameters<MerchantResolverPlugin["resolve"]>[0]) {
    const rawLabel = transactionMerchantLabel(context.transaction);
    if (!rawLabel) return undefined;
    const domain =
      context.resolution.status === "suggested"
        ? context.resolution.candidates
            .map((candidate) => candidate.domain)
            .find((candidate) => isValidDomain(candidate))
        : domainInMerchantLabel(rawLabel);
    if (!domain) return undefined;
    const merchant = await this.store.findByDomain(this.project, domain);
    if (!merchant) return undefined;
    return {
      status: "confirmed",
      rawLabel,
      merchant: {
        ...merchant,
        provenance: [
          ...merchant.provenance,
          {
            source: "alias",
            provider: "confirmed-domain-match",
            observedAt: nowIso(),
          },
        ],
        logoUrl: merchantLogoUrlFor(this.project, merchant, this.enrichment),
      },
      explanation: `Matched confirmed merchant ${merchant.canonicalName} by its domain.`,
    } satisfies MerchantResolution;
  }
}

type CodexMerchantResult = {
  kind: "candidate" | "unknown" | "not-a-merchant";
  canonicalName?: string | null;
  domain?: string | null;
  description?: string | null;
  industry?: string | null;
  countryCode?: string | null;
  rawScore?: number | null;
  explanation: string;
};

function optionalSchemaString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Optional merchant advisor with a deliberately narrow, privacy-filtered input. */
export class CodexMerchantAdvisor implements MerchantResolverPlugin {
  readonly id = "codex-merchant-advisor";

  constructor(
    readonly options: CodexPluginOptions & {
      countryCode?: string;
    } = {},
  ) {}

  async resolve(context: Parameters<MerchantResolverPlugin["resolve"]>[0]) {
    const rawLabel = transactionMerchantLabel(context.transaction);
    if (!rawLabel) return undefined;
    const directory = await fs.mkdtemp(
      join(tmpdir(), "beancount-js-merchant-"),
    );
    const schemaPath = join(directory, "schema.json");
    // OpenAI structured outputs require every property key in `required`.
    // Optional fields are therefore nullable rather than omitted.
    const schema = {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["candidate", "unknown", "not-a-merchant"],
        },
        canonicalName: { type: ["string", "null"] },
        domain: { type: ["string", "null"] },
        description: { type: ["string", "null"] },
        industry: { type: ["string", "null"] },
        countryCode: { type: ["string", "null"] },
        rawScore: { type: ["number", "null"], minimum: 0, maximum: 1 },
        explanation: { type: "string" },
      },
      required: [
        "kind",
        "canonicalName",
        "domain",
        "description",
        "industry",
        "countryCode",
        "rawScore",
        "explanation",
      ],
      additionalProperties: false,
    };
    let promptPayload: unknown;
    let response: string | undefined;
    let failure: string | undefined;
    try {
      await fs.writeFile(schemaPath, JSON.stringify(schema), { mode: 0o600 });
      promptPayload = {
        task: "Identify a merchant from a normalized transaction label. Return a candidate only when the supplied label supports it. Do not infer purchases, categories, or account details. Return JSON matching the schema and no prose.",
        merchant: {
          normalizedLabel: merchantAdvisorLabel(rawLabel),
          sourceId: context.transaction.sourceId,
          currency: context.transaction.currency,
          countryCode: this.options.countryCode,
        },
      };
      const prompt = JSON.stringify(promptPayload);
      response = await runCodex(
        codexExecArgs({
          directory,
          schemaPath,
          model: this.options.model,
          prompt,
        }),
        this.options.timeoutMs ?? 60_000,
      );
      const result = JSON.parse(response) as CodexMerchantResult;
      if (
        !result ||
        !["candidate", "unknown", "not-a-merchant"].includes(result.kind) ||
        typeof result.explanation !== "string" ||
        result.explanation.length > 500
      ) {
        throw new Error("Codex returned an invalid merchant suggestion.");
      }
      if (result.kind !== "candidate") {
        return {
          status: "unresolved",
          rawLabel,
          explanation:
            result.kind === "not-a-merchant"
              ? "AI did not identify this label as a merchant."
              : result.explanation,
        } satisfies MerchantResolution;
      }
      const canonicalName = optionalSchemaString(result.canonicalName);
      const domain = optionalSchemaString(result.domain)?.toLowerCase();
      const description = optionalSchemaString(result.description);
      const industry = optionalSchemaString(result.industry);
      const countryCode = optionalSchemaString(
        result.countryCode,
      )?.toUpperCase();
      if (
        !canonicalName ||
        typeof result.rawScore !== "number" ||
        !Number.isFinite(result.rawScore) ||
        (domain !== undefined && !isValidDomain(domain)) ||
        (countryCode !== undefined && !/^[A-Z]{2}$/.test(countryCode))
      ) {
        throw new Error("Codex returned an invalid merchant candidate.");
      }
      const candidate: MerchantCandidate = {
        id: `ai:${normalizeMerchant(canonicalName)}:${domain ?? ""}`,
        canonicalName,
        domain,
        description,
        industry,
        countryCode,
        rawScore: Math.min(Math.max(result.rawScore, 0), 1),
        explanation: result.explanation,
        provenance: [
          {
            source: "ai",
            provider: "codex",
            model: this.options.model,
            version: "merchant-advisor-v1",
            observedAt: nowIso(),
          },
        ],
      };
      return {
        status: "suggested",
        rawLabel,
        candidates: [candidate],
        explanation: candidate.explanation,
      } satisfies MerchantResolution;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      if (promptPayload !== undefined) {
        this.options.onDebug?.({
          id: this.id,
          label: "AI merchant advisor",
          prompt: prettyJson(promptPayload),
          response: response ? prettyJson(response) : undefined,
          error: failure,
          ok: !failure,
          at: nowIso(),
        });
      }
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
}

export function withBrandfetchLogo(
  candidate: MerchantCandidate,
  project: string,
): MerchantCandidate | undefined {
  if (!isValidDomain(candidate.domain)) return undefined;
  return {
    ...candidate,
    logoUrl: brandfetchDomainLogoUrl(project, candidate.domain!),
    provenance: [
      ...candidate.provenance,
      {
        source: "brandfetch",
        provider: "logo-api",
        version: "cdn",
        observedAt: nowIso(),
      },
    ],
  } satisfies MerchantCandidate;
}

class BrandfetchLogoResolver implements MerchantResolverPlugin {
  readonly id = "brandfetch-logo";

  constructor(private readonly project: string) {}

  async resolve(context: Parameters<MerchantResolverPlugin["resolve"]>[0]) {
    const rawLabel = transactionMerchantLabel(context.transaction);
    if (!rawLabel || context.resolution.status === "suppressed")
      return undefined;
    const candidate =
      context.resolution.status === "suggested"
        ? context.resolution.candidates.find((item) =>
            isValidDomain(item.domain),
          )
        : ({
            id: `source:${normalizeMerchant(rawLabel)}`,
            canonicalName: rawLabel,
            domain: domainInMerchantLabel(rawLabel),
            rawScore: 0,
            explanation: "Source merchant label awaiting validation.",
            provenance: [{ source: "source", observedAt: nowIso() }],
          } satisfies MerchantCandidate);
    if (!candidate) return undefined;
    const enriched = withBrandfetchLogo(candidate, this.project);
    if (!enriched) return undefined;
    return {
      status: "suggested",
      rawLabel,
      candidates: [enriched],
      explanation: `Brandfetch Logo API attached a logo for ${enriched.domain}.`,
    } satisfies MerchantResolution;
  }
}

function nowIso() {
  return new Date().toISOString();
}

export interface IngestMerchantContext {
  projectId: string;
  store: FilesystemIngestionStore;
}

async function merchantResolversFor(
  source: IngestionSourceDefinition,
  model: string | undefined,
  context: IngestMerchantContext | undefined,
  options?: {
    onAiDebug?: (call: AiEnrichmentDebugCall) => void;
    brandfetch?: BrandfetchEnrichmentConfig;
  },
) {
  const enrichment = source.merchantEnrichment;
  if (!enrichment?.enabled || !context) return [] as MerchantResolverPlugin[];
  const projectRoot = await context.store.projectRoot(context.projectId);
  const brandfetch =
    options?.brandfetch ??
    (await context.store.readConfig(context.projectId)).brandfetch;
  const brandfetchRuntime = await resolveBrandfetchRuntime(
    brandfetch,
    projectRoot,
  );
  const resolvedEnrichment = enrichmentWithResolvedClientId(
    { ...enrichment, brandfetch },
    brandfetchRuntime?.clientId,
  );
  const resolvers: MerchantResolverPlugin[] = [
    new ProfileMerchantResolver(
      context.store.merchants,
      context.projectId,
      resolvedEnrichment,
    ),
    new ExistingDomainMerchantResolver(
      context.store.merchants,
      context.projectId,
      resolvedEnrichment,
    ),
  ];
  if (enrichment.aiEnabled)
    resolvers.push(
      new CodexMerchantAdvisor({
        model,
        countryCode: enrichment.countryCode,
        onDebug: options?.onAiDebug,
      }),
    );
  // An AI candidate can name a domain that belongs to an existing profile.
  // This remains an exact domain match, never a name-similarity merge.
  if (enrichment.aiEnabled)
    resolvers.push(
      new ExistingDomainMerchantResolver(
        context.store.merchants,
        context.projectId,
        resolvedEnrichment,
      ),
    );
  if (brandfetch?.enabled && brandfetchRuntime?.clientId) {
    resolvers.push(new BrandfetchLogoResolver(context.projectId));
  }
  return resolvers;
}

export type IngestSourceResult = {
  runs: IngestionRun[];
  /** Sync bookmarks to persist for successfully completed targets. */
  syncStatePatches: Record<string, ConnectorSyncState>;
};

export async function ingestSource(
  source: IngestionSourceDefinition,
  state: Pick<
    IngestionState,
    | "cursors"
    | "syncState"
    | "seenImportIds"
    | "seenFingerprints"
    | "seenProviderImportIds"
  >,
  entries: readonly Directive[],
  model?: string,
  merchantContext?: IngestMerchantContext,
  options?: IngestProgressOptions,
): Promise<IngestSourceResult> {
  ensureConnectorsRegistered();
  const targets = expandIngestionSource(source, options);
  const runs: IngestionRun[] = [];
  const syncStatePatches: Record<string, ConnectorSyncState> = {};
  let seenImportIds = [...state.seenImportIds];
  let seenFingerprints = [...state.seenFingerprints];
  let seenProviderImportIds = [...state.seenProviderImportIds];
  const accountTotal = targets.length;
  const connector = isConnectorIngestionSource(source)
    ? requireConnector(source.kind)
    : undefined;
  const brandfetch = merchantContext
    ? (await merchantContext.store.readConfig(merchantContext.projectId))
        .brandfetch
    : undefined;

  for (const [index, target] of targets.entries()) {
    const linked = source.accounts?.find(
      (account) =>
        account.id === target.accountId ||
        jsonApiAccountSourceId(source.id, account.id) === target.sourceId,
    );
    const accountName = linked?.name ?? target.sourceAccount;
    const accountIndex = index + 1;
    await options?.onProgress?.({
      stage: "account",
      message: `Syncing ${accountName} (${accountIndex} of ${accountTotal})`,
      accountIndex,
      accountTotal,
      accountName,
      seen: 0,
      imported: 0,
    });
    const allAccounts = [...new Set(entries.flatMap((entry) => entry.accounts))]
      .filter(Boolean)
      .sort();
    const availableAccounts = categoryAccountsForSource(
      {
        ...source,
        sourceAccount: target.sourceAccount,
        accounts: undefined,
      },
      allAccounts,
    );
    const detectionRules = resolveDetectionRules(source, options);
    const aiCalls: AiEnrichmentCallRecord[] = [];
    const categorizers = buildCategorizers(detectionRules, {
      aiEnabled: source.aiEnabled === true,
      model,
      onAiDebug: (call) => aiCalls.push(call),
    });
    const hooks = buildRuleHooks(detectionRules);
    const projectRoot = merchantContext
      ? await merchantContext.store.projectRoot(merchantContext.projectId)
      : undefined;
    const env = await resolveProjectEnv(projectRoot);
    const resolveSecret = async (reference: string) =>
      resolveEnvSecret(reference, env);

    const priorSync = state.syncState?.[target.sourceId];
    const prepare = connector
      ? connector.prepareFetch({
          config: source.config,
          sourceId: target.sourceId,
          accountId: target.accountId,
          syncState: priorSync,
        })
      : {
          fetchContext: {},
          cursor:
            typeof priorSync?.cursor === "string"
              ? priorSync.cursor
              : state.cursors[target.sourceId],
        };

    const run = connector
      ? await runIngestion({
          source: connector.createSource(source.config),
          sourceConfig: source.config,
          sourceId: target.sourceId,
          sourceAccount: target.sourceAccount,
          normalizer: connector.createNormalizer(source.config),
          categorizers,
          hooks,
          merchantResolvers: await merchantResolversFor(
            source,
            model,
            merchantContext,
            {
              brandfetch,
              onAiDebug: (call) => aiCalls.push(call),
            },
          ),
          history: historySamplesFromEntries(entries),
          availableAccounts,
          existingImportIds: new Set(seenImportIds),
          existingFingerprints: new Set(seenFingerprints),
          existingProviderImportIds: new Set(seenProviderImportIds),
          providerImportIdentity: (transaction) =>
            providerImportIdentity(source.kind, transaction),
          cursor: prepare.cursor,
          defaultCurrency: target.defaultCurrency,
          sourceContext: {
            resolveSecret,
            fetchContext: prepare.fetchContext,
          },
          onProgress: async (progress) => {
            await options?.onProgress?.({
              ...progress,
              accountIndex,
              accountTotal,
              accountName,
            });
          },
        })
      : await runIngestion({
          source: new JsonApiSource(),
          sourceConfig: target.api!,
          sourceId: target.sourceId,
          sourceAccount: target.sourceAccount,
          normalizer: new JsonMappingNormalizer(source.mapping!),
          categorizers,
          hooks,
          merchantResolvers: await merchantResolversFor(
            source,
            model,
            merchantContext,
            {
              brandfetch,
              onAiDebug: (call) => aiCalls.push(call),
            },
          ),
          history: historySamplesFromEntries(entries),
          availableAccounts,
          existingImportIds: new Set(seenImportIds),
          existingFingerprints: new Set(seenFingerprints),
          cursor: prepare.cursor,
          defaultCurrency: target.defaultCurrency,
          sourceContext: {
            resolveSecret,
            fetchContext: prepare.fetchContext,
          },
          onProgress: async (progress) => {
            await options?.onProgress?.({
              ...progress,
              accountIndex,
              accountTotal,
              accountName,
            });
          },
        });

    const archivedRun = aiCalls.length
      ? { ...run, audit: { ai: aiCalls } }
      : run;
    runs.push(archivedRun);
    if (connector) {
      syncStatePatches[target.sourceId] = connector.commitSyncState({
        config: source.config,
        sourceId: target.sourceId,
        previous: priorSync,
        prepare,
        run,
      });
    } else if (run.cursor !== undefined) {
      syncStatePatches[target.sourceId] = { cursor: run.cursor };
    }

    seenImportIds = [
      ...seenImportIds,
      ...run.proposals
        .filter((proposal) => proposal.status !== "invalid")
        .map((proposal) => proposal.importId),
    ];
    seenFingerprints = [
      ...seenFingerprints,
      ...run.proposals.flatMap((proposal) =>
        proposal.transaction
          ? [transactionFingerprint(proposal.transaction)]
          : [],
      ),
    ];
    if (connector) {
      seenProviderImportIds = [
        ...seenProviderImportIds,
        ...run.proposals.flatMap((proposal) =>
          proposal.transaction
            ? [providerImportIdentity(source.kind, proposal.transaction)]
            : [],
        ),
      ].filter((id): id is string => Boolean(id));
    }
  }

  return { runs, syncStatePatches };
}

function sourceHasAiEnabled(source: IngestionSourceDefinition) {
  return (
    source.aiEnabled === true ||
    (source.merchantEnrichment?.enabled === true &&
      source.merchantEnrichment.aiEnabled === true)
  );
}

async function resolveMerchantWithResolvers(
  transaction: NonNullable<ImportProposal["transaction"]>,
  resolvers: readonly MerchantResolverPlugin[],
) {
  const rawLabel =
    transaction.merchant ?? transaction.payee ?? transaction.narration;
  let resolution: MerchantResolution = rawLabel
    ? {
        status: "unresolved",
        rawLabel,
        explanation: "No confirmed merchant profile matched this transaction.",
      }
    : {
        status: "unresolved",
        explanation: "No merchant label was supplied.",
      };
  const issues: string[] = [];
  for (const resolver of resolvers) {
    if (
      resolution.status === "confirmed" ||
      resolution.status === "suppressed"
    ) {
      break;
    }
    try {
      const next = await resolver.resolve({ transaction, resolution });
      if (!next) continue;
      if (resolution.status === "suggested" && next.status === "suggested") {
        resolution = {
          ...next,
          candidates: [
            ...next.candidates,
            ...resolution.candidates.filter(
              (candidate) =>
                !next.candidates.some((item) => item.id === candidate.id),
            ),
          ],
        };
      } else {
        resolution = next;
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      issues.push(
        resolver.id === "codex-merchant-advisor"
          ? `AI merchant advisor was unavailable: ${detail}`
          : `Merchant resolver ${resolver.id} was unavailable: ${detail}`,
      );
    }
  }
  return { resolution, issues };
}

type EnrichPrepared = {
  aiMerchant: boolean;
  availableAccounts: string[];
  history: ReturnType<typeof historySamplesFromEntries>;
  categorizers: CategorizerPlugin[];
  merchantResolvers: MerchantResolverPlugin[];
};

async function prepareAiEnrichment(
  source: IngestionSourceDefinition,
  entries: readonly Directive[],
  model: string | undefined,
  merchantContext: IngestMerchantContext,
  options?: {
    onAiDebug?: (call: AiEnrichmentDebugCall) => void;
    detectionRules?: readonly DetectionRule[];
  },
): Promise<EnrichPrepared> {
  if (!sourceHasAiEnabled(source)) {
    throw new Error(
      "Enable AI categorisation or AI merchant enrichment first.",
    );
  }
  const aiCategorize = source.aiEnabled === true;
  const aiMerchant =
    source.merchantEnrichment?.enabled === true &&
    source.merchantEnrichment.aiEnabled === true;
  const allAccounts = [...new Set(entries.flatMap((entry) => entry.accounts))]
    .filter(Boolean)
    .sort();
  const availableAccounts = categoryAccountsForSource(source, allAccounts);
  const history = historySamplesFromEntries(entries);
  const detectionRules = resolveDetectionRules(source, options);
  const categorizers = buildCategorizers(detectionRules, {
    aiEnabled: aiCategorize,
    model,
    onAiDebug: options?.onAiDebug,
  });
  const merchantResolvers = aiMerchant
    ? await merchantResolversFor(source, model, merchantContext, {
        onAiDebug: options?.onAiDebug,
      })
    : [];
  return {
    aiMerchant,
    availableAccounts,
    history,
    categorizers,
    merchantResolvers,
  };
}

async function enrichProposalWithPrepared(
  proposal: ImportProposal,
  prepared: EnrichPrepared,
  options?: {
    source?: AiEnrichmentSnapshot["source"];
    jobId?: string;
    calls?: AiEnrichmentCallRecord[];
    merchantOnly?: boolean;
  },
): Promise<ImportProposal> {
  if (!proposal.transaction) {
    throw new Error("This proposal has no transaction to enrich.");
  }
  if (
    proposal.status !== "ready" &&
    proposal.status !== "needs-review" &&
    proposal.status !== "held"
  ) {
    throw new Error("This proposal cannot be enriched.");
  }
  const transaction = proposal.transaction;
  let merchantResolution = proposal.merchantResolution;
  let nextIssues = (proposal.issues ?? []).filter(
    (issue) =>
      !issue.startsWith("Merchant resolver ") &&
      !issue.startsWith("AI merchant advisor ") &&
      !(options?.merchantOnly ? false : issue.startsWith("AI categoriser ")),
  );
  if (
    prepared.aiMerchant &&
    merchantResolution?.status !== "confirmed" &&
    merchantResolution?.status !== "suppressed"
  ) {
    const resolved = await resolveMerchantWithResolvers(
      transaction,
      prepared.merchantResolvers,
    );
    merchantResolution = resolved.resolution;
    nextIssues = [...nextIssues, ...resolved.issues];
  }

  const calls = options?.calls ?? [];
  const lastAiEnrichment: AiEnrichmentSnapshot | undefined = calls.length
    ? {
        at: nowIso(),
        source: options?.source ?? "enrich",
        jobId: options?.jobId,
        ok: calls.every((call) => call.ok),
        calls,
      }
    : proposal.lastAiEnrichment;

  if (options?.merchantOnly) {
    return {
      ...proposal,
      merchantResolution,
      issues: nextIssues,
      lastAiEnrichment,
    };
  }

  const manualSelection = proposal.suggestions.find(
    (suggestion) =>
      suggestion.method === "manual" &&
      suggestion.account === proposal.selectedAccount,
  );
  const suggestions: CategorySuggestion[] = [];
  const context: CategorizationContext = {
    transaction,
    merchant:
      merchantResolution?.status === "confirmed"
        ? merchantResolution.merchant
        : undefined,
    history: prepared.history,
    availableAccounts: prepared.availableAccounts,
  };
  for (const categorizer of prepared.categorizers) {
    try {
      suggestions.push(
        ...(await categorizer.suggest({
          ...context,
          priorSuggestions: sortSuggestions(suggestions),
        })),
      );
    } catch (error) {
      if (categorizer.isAi) {
        const message = error instanceof Error ? error.message : String(error);
        nextIssues = [
          ...nextIssues,
          `AI categoriser was unavailable: ${message}`,
        ];
        suggestions.push({
          account: "",
          rawScore: 0,
          scoreKind: "ai-advisory",
          method: "ai",
          explanation:
            "An optional categorizer was unavailable; review this transaction manually.",
          evidence: [],
        });
      }
    }
  }
  const nextSuggestions = sortSuggestions(
    [...suggestions, ...(manualSelection ? [manualSelection] : [])].filter(
      (suggestion) =>
        Boolean(suggestion.account) &&
        prepared.availableAccounts.includes(suggestion.account),
    ),
  );
  return {
    ...proposal,
    merchantResolution,
    suggestions: nextSuggestions,
    selectedAccount: manualSelection?.account ?? nextSuggestions[0]?.account,
    status:
      transaction.status === "pending"
        ? "held"
        : nextSuggestions.length
          ? "ready"
          : "needs-review",
    issues: nextIssues,
    lastAiEnrichment,
  };
}

/**
 * Re-run AI merchant enrichment and/or AI categorisation on a single import
 * proposal. Always captures prompts/responses onto `proposal.lastAiEnrichment`.
 */
export async function enrichProposal(
  source: IngestionSourceDefinition,
  proposal: ImportProposal,
  entries: readonly Directive[],
  model: string | undefined,
  merchantContext: IngestMerchantContext,
  options?: {
    collectDebug?: boolean;
    jobId?: string;
    merchantOnly?: boolean;
    detectionRules?: readonly DetectionRule[];
  },
): Promise<{ proposal: ImportProposal; debug: AiEnrichmentDebug }> {
  const calls: AiEnrichmentCallRecord[] = [];
  const prepared = await prepareAiEnrichment(
    source,
    entries,
    model,
    merchantContext,
    {
      onAiDebug: (call) => {
        calls.push(call);
      },
      detectionRules: options?.detectionRules,
    },
  );
  const next = await enrichProposalWithPrepared(proposal, prepared, {
    source: "enrich",
    jobId: options?.jobId,
    calls,
    merchantOnly: options?.merchantOnly,
  });
  return {
    proposal: next,
    debug: { calls },
  };
}

/**
 * Re-run AI merchant enrichment and/or AI categorisation on existing import
 * proposals without fetching new transactions from the provider.
 */
export async function enrichExistingSourceRuns(
  source: IngestionSourceDefinition,
  runs: readonly IngestionRun[],
  entries: readonly Directive[],
  model: string | undefined,
  merchantContext: IngestMerchantContext,
  options?: {
    jobId?: string;
    detectionRules?: readonly DetectionRule[];
    onProgress?: (progress: {
      index: number;
      total: number;
      message: string;
    }) => void | Promise<void>;
  },
) {
  let currentCalls: AiEnrichmentCallRecord[] | undefined;
  const prepared = await prepareAiEnrichment(
    source,
    entries,
    model,
    merchantContext,
    {
      onAiDebug: (call) => {
        currentCalls?.push(call);
      },
      detectionRules: options?.detectionRules,
    },
  );

  const work = runs.flatMap((run) =>
    run.proposals
      .filter(
        (proposal) =>
          Boolean(proposal.transaction) &&
          (proposal.status === "ready" ||
            proposal.status === "needs-review" ||
            proposal.status === "held"),
      )
      .map((proposal) => ({ runId: run.id, proposal })),
  );
  const total = work.length;
  if (!total) {
    throw new Error("No reviewable proposals are available to enrich.");
  }

  const updatedByRun = new Map<string, ImportProposal[]>();
  for (const run of runs) {
    updatedByRun.set(
      run.id,
      run.proposals.map((proposal) => ({ ...proposal })),
    );
  }

  let index = 0;
  for (const { runId, proposal } of work) {
    index += 1;
    await options?.onProgress?.({
      index,
      total,
      message: `AI enriching ${index} of ${total}…`,
    });
    currentCalls = [];
    const next = await enrichProposalWithPrepared(proposal, prepared, {
      source: "ai-rerun",
      jobId: options?.jobId,
      calls: currentCalls,
    });
    const list = updatedByRun.get(runId)!;
    const proposalIndex = list.findIndex((item) => item.id === proposal.id);
    if (proposalIndex >= 0) list[proposalIndex] = next;
  }

  return runs.map((run) => {
    const proposals = updatedByRun.get(run.id) ?? run.proposals;
    return {
      ...run,
      proposals,
      summary: summarize(proposals),
    } satisfies IngestionRun;
  });
}

/** Re-run deterministic category evidence after a merchant is explicitly confirmed. */
export async function recategorizeProposal(
  source: IngestionSourceDefinition,
  proposal: ImportProposal,
  entries: readonly Directive[],
  options?: { detectionRules?: readonly DetectionRule[] },
) {
  if (!proposal.transaction) return proposal;
  const manualSelection = proposal.suggestions.find(
    (suggestion) =>
      suggestion.method === "manual" &&
      suggestion.account === proposal.selectedAccount,
  );

  const accounts = categoryAccountsForSource(
    source,
    entries.flatMap((entry) => entry.accounts),
  );
  const detectionRules = resolveDetectionRules(source, options);
  const categorizers = buildCategorizers(detectionRules);
  const suggestions: CategorySuggestion[] = [];
  const context: CategorizationContext = {
    transaction: proposal.transaction,
    merchant:
      proposal.merchantResolution?.status === "confirmed"
        ? proposal.merchantResolution.merchant
        : undefined,
    history: historySamplesFromEntries(entries),
    availableAccounts: accounts,
  };
  for (const categorizer of categorizers) {
    try {
      suggestions.push(
        ...(await categorizer.suggest({
          ...context,
          priorSuggestions: sortSuggestions(suggestions),
        })),
      );
    } catch {
      // Deterministic suggestions are optional evidence; a review row stays usable.
    }
  }
  const preservedAi = proposal.suggestions.filter(
    (suggestion) => suggestion.method === "ai",
  );
  const nextSuggestions = sortSuggestions(
    [
      ...suggestions,
      ...preservedAi,
      ...(manualSelection ? [manualSelection] : []),
    ].filter(
      (suggestion) =>
        Boolean(suggestion.account) && accounts.includes(suggestion.account),
    ),
  );
  return {
    ...proposal,
    suggestions: nextSuggestions,
    selectedAccount: manualSelection?.account ?? nextSuggestions[0]?.account,
    status:
      proposal.transaction.status === "pending"
        ? "held"
        : nextSuggestions.length
          ? "ready"
          : "needs-review",
  } satisfies ImportProposal;
}
