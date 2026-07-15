import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  JsonApiSource,
  JsonMappingNormalizer,
  MerchantRuleCategorizer,
  HistoricalCategorizer,
  RecurringCategorizer,
  historySamplesFromEntries,
  runIngestion,
  normalizeMerchant,
  sortSuggestions,
  transactionFingerprint,
  discoverJsonApiAccounts,
  isGroupedJsonApiSource,
  jsonApiAccountSourceId,
  jsonApiAccountTransactionsEndpoint,
  type CategorizationContext,
  type CategorizerPlugin,
  type CategoryEvidence,
  type CategorySuggestion,
  type DiscoveredJsonApiAccount,
  type ImportProposal,
  type IngestionRun,
  type JsonApiLinkedAccount,
  type JsonApiSourceConfig,
  type JsonMappingConfig,
  type MerchantRule,
  type MerchantCandidate,
  type MerchantResolution,
  type MerchantResolverPlugin,
} from "@beancount-js/beangulp";
import type { Directive } from "@beancount-js/beancount";
import {
  BrandfetchProvider,
  brandfetchLogoUrl,
  isValidDomain,
} from "./brandfetch";
import { FilesystemMerchantStore } from "./merchant";

const VERSION = 1;
const RUN_LIMIT = 20;
const SEEN_LIMIT = 10_000;

export interface BrandfetchEnrichmentConfig {
  enabled: boolean;
  apiKeySecretRef: string;
  clientId?: string;
  allowNameSearch?: boolean;
  allowTransactionLookup?: boolean;
  assetMode?: "hotlink" | "cache";
  cacheContentAllowed?: boolean;
  ttlDays?: number;
}

export interface MerchantEnrichmentConfig {
  enabled: boolean;
  aiEnabled?: boolean;
  countryCode?: string;
  brandfetch?: BrandfetchEnrichmentConfig;
}

export interface IngestionSourceDefinition {
  id: string;
  name: string;
  kind: "json-api";
  /**
   * Beancount asset account for standalone sources.
   * Grouped connections set this per nested `accounts[]` entry instead.
   */
  sourceAccount?: string;
  destinationPath?: string;
  defaultCurrency?: string;
  allowedAccountRoots?: string[];
  aiEnabled?: boolean;
  /** Markdown shown in the connection preview setup callout. */
  setup?: string;
  merchantEnrichment?: MerchantEnrichmentConfig;
  api: JsonApiSourceConfig;
  mapping: JsonMappingConfig;
  rules: MerchantRule[];
  /** Nested bank accounts for multi-account providers (e.g. Lunch Flow). */
  accounts?: JsonApiLinkedAccount[];
}

export interface IngestionConfig {
  version: 1;
  sources: IngestionSourceDefinition[];
}

interface IngestionState {
  version: 1;
  cursors: Record<string, string | undefined>;
  seenImportIds: string[];
  seenFingerprints: string[];
  runs: IngestionRun[];
}

function defaultDirectory() {
  return (
    process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config", "beancount-js")
  );
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

function stateDefaults(): IngestionState {
  return {
    version: VERSION,
    cursors: {},
    seenImportIds: [],
    seenFingerprints: [],
    runs: [],
  };
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
  const brandfetch = value.brandfetch;
  if (!brandfetch) return { ...value, countryCode };
  if (typeof brandfetch.enabled !== "boolean")
    throw new Error("merchantEnrichment.brandfetch.enabled must be a boolean.");
  if (
    brandfetch.enabled &&
    (!brandfetch.apiKeySecretRef || !brandfetch.apiKeySecretRef.trim())
  ) {
    throw new Error("Brandfetch needs an API key or env: variable reference.");
  }
  if (
    brandfetch.apiKeySecretRef?.startsWith("env:") &&
    !brandfetch.apiKeySecretRef.slice("env:".length).trim()
  ) {
    throw new Error("Brandfetch env: references need a variable name.");
  }
  if (brandfetch.assetMode === "cache" && !brandfetch.cacheContentAllowed) {
    throw new Error(
      "Local Brandfetch caching requires cacheContentAllowed: true.",
    );
  }
  if (
    brandfetch.ttlDays !== undefined &&
    (!Number.isInteger(brandfetch.ttlDays) ||
      brandfetch.ttlDays < 1 ||
      brandfetch.ttlDays > 29)
  ) {
    throw new Error("Brandfetch ttlDays must be an integer from 1 to 29.");
  }
  if (brandfetch.allowTransactionLookup && !countryCode) {
    throw new Error(
      "Brandfetch transaction lookups need merchantEnrichment.countryCode.",
    );
  }
  return {
    ...value,
    countryCode,
    brandfetch: {
      ...brandfetch,
      clientId: brandfetch.clientId?.trim() || undefined,
    },
  } satisfies MerchantEnrichmentConfig;
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
  return {
    id: account.id.trim(),
    name: account.name.trim(),
    sourceAccount: account.sourceAccount.trim(),
    defaultCurrency: account.defaultCurrency?.trim() || undefined,
  } satisfies JsonApiLinkedAccount;
}

function validateSource(
  source: IngestionSourceDefinition,
): IngestionSourceDefinition {
  sourceId(source.id);
  if (!source.name.trim()) throw new Error("An ingestion source needs a name.");
  if (source.kind !== "json-api")
    throw new Error(
      "Only JSON API sources are supported in the first release.",
    );
  if (!source.api?.secretRef?.trim()) {
    throw new Error(
      "JSON API sources need an API key (or env: reference).",
    );
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
  if (source.setup !== undefined && typeof source.setup !== "string") {
    throw new Error("Source setup must be markdown text.");
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
    if (!source.accounts?.length) {
      throw new Error(
        "Grouped JSON API sources need at least one linked account.",
      );
    }
    accounts = source.accounts.map(validateLinkedAccount);
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
    sourceAccount,
    accounts,
    setup: source.setup?.trim() || undefined,
    api,
    rules: source.rules ?? [],
    allowedAccountRoots: source.allowedAccountRoots?.filter(Boolean),
    merchantEnrichment: validateMerchantEnrichment(source.merchantEnrichment),
  };
}

/** Local persistence for configurations and actionable, normalized runs. */
export class FilesystemIngestionStore {
  readonly merchants: FilesystemMerchantStore;

  constructor(readonly configDirectory = defaultDirectory()) {
    this.merchants = new FilesystemMerchantStore(configDirectory);
  }

  private path(project: string, name: string) {
    return join(
      this.configDirectory,
      "projects",
      projectId(project),
      "ingestion",
      name,
    );
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
    return readJson(this.path(project, "sources.json"), configDefaults());
  }

  async writeConfig(project: string, config: IngestionConfig) {
    const sources = config.sources.map(validateSource);
    if (new Set(sources.map((source) => source.id)).size !== sources.length) {
      throw new Error("Ingestion source identifiers must be unique.");
    }
    await this.write(this.path(project, "sources.json"), {
      version: VERSION,
      sources,
    });
  }

  async readState(project: string) {
    return readJson(this.path(project, "state.json"), stateDefaults());
  }

  private async writeState(project: string, state: IngestionState) {
    await this.write(this.path(project, "state.json"), state);
  }

  async source(project: string, id: string) {
    const config = await this.readConfig(project);
    const source = config.sources.find((item) => item.id === id);
    if (!source) throw new Error(`Unknown ingestion source: ${id}`);
    return source;
  }

  async saveRun(project: string, run: IngestionRun) {
    const state = await this.readState(project);
    const next = {
      ...state,
      cursors: { ...state.cursors, [run.sourceId]: run.cursor },
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
      runs: [run, ...state.runs.filter((item) => item.id !== run.id)].slice(
        0,
        RUN_LIMIT,
      ),
    } satisfies IngestionState;
    await this.writeState(project, next);
    return run;
  }

  async run(project: string, runId: string) {
    const run = (await this.readState(project)).runs.find(
      (item) => item.id === runId,
    );
    if (!run) throw new Error(`Unknown ingestion run: ${runId}`);
    return run;
  }

  async updateProposal(
    project: string,
    runId: string,
    proposalId: string,
    account: string,
  ) {
    const state = await this.readState(project);
    const run = state.runs.find((item) => item.id === runId);
    if (!run) throw new Error(`Unknown ingestion run: ${runId}`);
    const proposals = run.proposals.map((proposal) => {
      if (proposal.id !== proposalId) return proposal;
      if (
        !proposal.transaction ||
        proposal.status === "duplicate" ||
        proposal.status === "invalid" ||
        proposal.status === "held"
      ) {
        throw new Error("This proposal cannot be categorised.");
      }
      // A user choosing an already-suggested account is still an explicit
      // category decision. Preserve it through merchant re-categorisation.
      const suggestions = [
        ...proposal.suggestions.filter((item) => item.method !== "manual"),
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
              id: `manual:${proposal.id}:${account}`,
              kind: "manual" as const,
              summary: "Manual account selection",
            },
          ],
        },
      ];
      return {
        ...proposal,
        selectedAccount: account,
        suggestions,
        status: "ready" as const,
      };
    });
    const updated = { ...run, proposals, summary: summarize(proposals) };
    state.runs = state.runs.map((item) => (item.id === runId ? updated : item));
    await this.writeState(project, state);
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
    const state = await this.readState(project);
    const run = state.runs.find((item) => item.id === runId);
    if (!run) throw new Error(`Unknown ingestion run: ${runId}`);
    if (!run.proposals.some((item) => item.id === proposal.id))
      throw new Error(`Unknown ingestion proposal: ${proposal.id}`);
    const updated = {
      ...run,
      proposals: run.proposals.map((item) =>
        item.id === proposal.id ? proposal : item,
      ),
    } satisfies IngestionRun;
    const complete = { ...updated, summary: summarize(updated.proposals) };
    state.runs = state.runs.map((item) =>
      item.id === runId ? complete : item,
    );
    await this.writeState(project, state);
    return complete;
  }

  async markAccepted(
    project: string,
    runId: string,
    proposalIds: readonly string[],
  ) {
    const state = await this.readState(project);
    const run = state.runs.find((item) => item.id === runId);
    if (!run) throw new Error(`Unknown ingestion run: ${runId}`);
    const accepted = new Set(proposalIds);
    const proposals = run.proposals.map((proposal) =>
      accepted.has(proposal.id)
        ? {
            ...proposal,
            status: "duplicate" as const,
            duplicateOf: proposal.importId,
            transaction: undefined,
          }
        : proposal,
    );
    const updated = { ...run, proposals, summary: summarize(proposals) };
    state.runs = state.runs.map((item) => (item.id === runId ? updated : item));
    await this.writeState(project, state);
    return updated;
  }
}

function summarize(proposals: readonly ImportProposal[]) {
  return {
    total: proposals.length,
    ready: proposals.filter((proposal) => proposal.status === "ready").length,
    needsReview: proposals.filter(
      (proposal) => proposal.status === "needs-review",
    ).length,
    duplicates: proposals.filter((proposal) => proposal.status === "duplicate")
      .length,
    invalid: proposals.filter((proposal) => proposal.status === "invalid")
      .length,
    held: proposals.filter((proposal) => proposal.status === "held").length,
  };
}

/** Returns the only accounts that a source may suggest or accept manually. */
export function categoryAccountsForSource(
  source: IngestionSourceDefinition,
  accounts: readonly string[],
) {
  const linkedSourceAccounts = isGroupedJsonApiSource(source)
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
  api: JsonApiSourceConfig;
};

/** Expand a standalone or grouped source into concrete fetch targets. */
export function expandIngestionSource(
  source: IngestionSourceDefinition,
  options?: { accountId?: string },
): ExpandedIngestionTarget[] {
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
      api: {
        ...source.api,
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

function resolveIngestionSecret(reference: string) {
  if (!reference?.trim()) return undefined;
  if (reference.startsWith("env:")) {
    const name = reference.slice("env:".length);
    return name ? process.env[name] : undefined;
  }
  return reference;
}

/** Discover remote accounts for a grouped provider connection. */
export async function discoverIngestionAccounts(options: {
  baseUrl: string;
  secretRef: string;
  authScheme?: "bearer" | "x-api-key";
  allowedHosts?: readonly string[];
  accountsPath?: string;
}): Promise<DiscoveredJsonApiAccount[]> {
  validateHttpsUrl(options.baseUrl, options.allowedHosts, "JSON API base URL");
  return discoverJsonApiAccounts({
    ...options,
    resolveSecret: async (reference) => resolveIngestionSecret(reference),
  });
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

type CodexResult = {
  account: string;
  rawScore: number;
  evidenceIds: string[];
};

/** Optional, structured Codex categorizer. It receives a bounded transaction and evidence summary only. */
export class CodexCategorizer implements CategorizerPlugin {
  readonly id = "codex-ai";
  readonly isAi = true;

  constructor(readonly options: { model?: string; timeoutMs?: number } = {}) {}

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
    try {
      await fs.writeFile(schemaPath, JSON.stringify(schema), { mode: 0o600 });
      const evidence =
        context.priorSuggestions?.flatMap(
          (suggestion) => suggestion.evidence,
        ) ?? [];
      const prompt = JSON.stringify({
        task: "Categorise one imported Beancount transaction. Choose only from availableAccounts. Use only supplied evidence IDs. Return the JSON schema response and no prose.",
        transaction: context.transaction,
        availableAccounts: context.availableAccounts,
        evidence: evidence.map((item) => ({
          id: item.id,
          summary: item.summary,
          occurrences: item.occurrences,
        })),
      });
      const args = [
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--ask-for-approval",
        "never",
        "--ignore-user-config",
        "--ignore-rules",
        "--cd",
        directory,
        "--output-schema",
        schemaPath,
        "-c",
        'web_search="disabled"',
        "-c",
        "features.shell_tool=false",
        "-c",
        "features.apps=false",
        "-c",
        "features.multi_agent=false",
        ...(this.options.model ? ["--model", this.options.model] : []),
        prompt,
      ];
      const raw = await runCodex(args, this.options.timeoutMs ?? 60_000);
      const result = JSON.parse(raw) as CodexResult;
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
    } finally {
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
  if (asset && Date.parse(asset.expiresAt) > Date.now()) {
    return `/api/projects/${encodeURIComponent(project)}/ingestion/merchants/${encodeURIComponent(merchant.merchantId)}/logo?v=${asset.sha256}`;
  }
  const clientId = enrichment.brandfetch?.clientId;
  return merchant.domain && clientId
    ? brandfetchLogoUrl(merchant.domain, clientId)
    : undefined;
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
  canonicalName?: string;
  domain?: string;
  description?: string;
  industry?: string;
  countryCode?: string;
  rawScore?: number;
  explanation: string;
};

/** Optional merchant advisor with a deliberately narrow, privacy-filtered input. */
export class CodexMerchantAdvisor implements MerchantResolverPlugin {
  readonly id = "codex-merchant-advisor";

  constructor(
    readonly options: {
      model?: string;
      timeoutMs?: number;
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
    const schema = {
      type: "object",
      properties: {
        kind: { enum: ["candidate", "unknown", "not-a-merchant"] },
        canonicalName: { type: "string" },
        domain: { type: "string" },
        description: { type: "string" },
        industry: { type: "string" },
        countryCode: { type: "string" },
        rawScore: { type: "number", minimum: 0, maximum: 1 },
        explanation: { type: "string" },
      },
      required: ["kind", "explanation"],
      additionalProperties: false,
    };
    try {
      await fs.writeFile(schemaPath, JSON.stringify(schema), { mode: 0o600 });
      const prompt = JSON.stringify({
        task: "Identify a merchant from a normalized transaction label. Return a candidate only when the supplied label supports it. Do not infer purchases, categories, or account details. Return JSON matching the schema and no prose.",
        merchant: {
          normalizedLabel: merchantAdvisorLabel(rawLabel),
          sourceId: context.transaction.sourceId,
          currency: context.transaction.currency,
          countryCode: this.options.countryCode,
        },
      });
      const raw = await runCodex(
        [
          "exec",
          "--ephemeral",
          "--skip-git-repo-check",
          "--sandbox",
          "read-only",
          "--ask-for-approval",
          "never",
          "--ignore-user-config",
          "--ignore-rules",
          "--cd",
          directory,
          "--output-schema",
          schemaPath,
          "-c",
          'web_search="disabled"',
          "-c",
          "features.shell_tool=false",
          "-c",
          "features.apps=false",
          "-c",
          "features.multi_agent=false",
          ...(this.options.model ? ["--model", this.options.model] : []),
          prompt,
        ],
        this.options.timeoutMs ?? 60_000,
      );
      const result = JSON.parse(raw) as CodexMerchantResult;
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
      if (
        !result.canonicalName?.trim() ||
        typeof result.rawScore !== "number" ||
        !Number.isFinite(result.rawScore) ||
        (result.domain !== undefined && !isValidDomain(result.domain)) ||
        (result.countryCode !== undefined &&
          !/^[A-Za-z]{2}$/.test(result.countryCode))
      ) {
        throw new Error("Codex returned an invalid merchant candidate.");
      }
      const candidate: MerchantCandidate = {
        id: `ai:${normalizeMerchant(result.canonicalName)}:${result.domain?.toLowerCase() ?? ""}`,
        canonicalName: result.canonicalName.trim(),
        domain: result.domain?.toLowerCase(),
        description: result.description?.trim() || undefined,
        industry: result.industry?.trim() || undefined,
        countryCode: result.countryCode?.toUpperCase(),
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
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }
}

class BrandfetchMerchantResolver implements MerchantResolverPlugin {
  readonly id = "brandfetch";

  constructor(
    private readonly provider: BrandfetchProvider,
    private readonly countryCode: string | undefined,
  ) {}

  async resolve(context: Parameters<MerchantResolverPlugin["resolve"]>[0]) {
    const rawLabel = transactionMerchantLabel(context.transaction);
    if (!rawLabel || context.resolution.status === "suppressed")
      return undefined;
    const candidate =
      context.resolution.status === "suggested"
        ? context.resolution.candidates[0]
        : ({
            id: `source:${normalizeMerchant(rawLabel)}`,
            canonicalName: rawLabel,
            rawScore: 0,
            explanation: "Source merchant label awaiting validation.",
            provenance: [{ source: "source", observedAt: nowIso() }],
          } satisfies MerchantCandidate);
    const enriched = await this.provider.enrich(candidate, {
      rawLabel,
      countryCode: this.countryCode,
    });
    if (!enriched) return undefined;
    return {
      status: "suggested",
      rawLabel,
      candidates: [enriched],
      explanation: enriched.explanation,
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

function merchantResolversFor(
  source: IngestionSourceDefinition,
  model: string | undefined,
  context: IngestMerchantContext | undefined,
) {
  const enrichment = source.merchantEnrichment;
  if (!enrichment?.enabled || !context) return [] as MerchantResolverPlugin[];
  const resolvers: MerchantResolverPlugin[] = [
    new ProfileMerchantResolver(
      context.store.merchants,
      context.projectId,
      enrichment,
    ),
    new ExistingDomainMerchantResolver(
      context.store.merchants,
      context.projectId,
      enrichment,
    ),
  ];
  if (enrichment.aiEnabled)
    resolvers.push(
      new CodexMerchantAdvisor({
        model,
        countryCode: enrichment.countryCode,
      }),
    );
  // An AI candidate can name a domain that belongs to an existing profile.
  // This remains an exact domain match, never a name-similarity merge.
  if (enrichment.aiEnabled)
    resolvers.push(
      new ExistingDomainMerchantResolver(
        context.store.merchants,
        context.projectId,
        enrichment,
      ),
    );
  const providerConfig = enrichment.brandfetch;
  const apiKey = providerConfig?.apiKeySecretRef
    ? providerConfig.apiKeySecretRef.startsWith("env:")
      ? process.env[providerConfig.apiKeySecretRef.slice("env:".length)]
      : providerConfig.apiKeySecretRef
    : undefined;
  if (providerConfig?.enabled && apiKey) {
    resolvers.push(
      new BrandfetchMerchantResolver(
        new BrandfetchProvider({ ...providerConfig, apiKey }),
        enrichment.countryCode,
      ),
    );
  }
  return resolvers;
}

export async function ingestSource(
  source: IngestionSourceDefinition,
  state: Pick<IngestionState, "cursors" | "seenImportIds" | "seenFingerprints">,
  entries: readonly Directive[],
  model?: string,
  merchantContext?: IngestMerchantContext,
  options?: { accountId?: string },
) {
  const targets = expandIngestionSource(source, options);
  const runs: IngestionRun[] = [];
  let seenImportIds = [...state.seenImportIds];
  let seenFingerprints = [...state.seenFingerprints];

  for (const target of targets) {
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
    const categorizers: CategorizerPlugin[] = [
      new MerchantRuleCategorizer(source.rules),
      new HistoricalCategorizer(),
      new RecurringCategorizer(),
    ];
    if (source.aiEnabled) categorizers.push(new CodexCategorizer({ model }));
    const run = await runIngestion({
      source: new JsonApiSource(),
      sourceConfig: target.api,
      sourceId: target.sourceId,
      sourceAccount: target.sourceAccount,
      normalizer: new JsonMappingNormalizer(source.mapping),
      categorizers,
      merchantResolvers: merchantResolversFor(source, model, merchantContext),
      history: historySamplesFromEntries(entries),
      availableAccounts,
      existingImportIds: new Set(seenImportIds),
      existingFingerprints: new Set(seenFingerprints),
      cursor: state.cursors[target.sourceId],
      defaultCurrency: target.defaultCurrency,
      sourceContext: {
        resolveSecret: async (reference) => resolveIngestionSecret(reference),
      },
    });
    runs.push(run);
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
  }

  return runs;
}

/** Re-run deterministic category evidence after a merchant is explicitly confirmed. */
export async function recategorizeProposal(
  source: IngestionSourceDefinition,
  proposal: ImportProposal,
  entries: readonly Directive[],
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
  const categorizers: CategorizerPlugin[] = [
    new MerchantRuleCategorizer(source.rules),
    new HistoricalCategorizer(),
    new RecurringCategorizer(),
  ];
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
