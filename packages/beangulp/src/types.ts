export type JsonRecord = Record<string, unknown>;

export type SecretResolver = (reference: string) => Promise<string | undefined>;

export interface SourceContext {
  sourceId: string;
  cursor?: string;
  signal?: AbortSignal;
  fetch?: typeof fetch;
  resolveSecret?: SecretResolver;
  maxPages?: number;
  maxRecords?: number;
  /**
   * Connector-provided fetch parameters for this run
   * (e.g. startDate, includePending, accountId).
   */
  fetchContext?: Record<string, unknown>;
}

export interface SourcePage<Record> {
  records: readonly Record[];
  nextCursor?: string;
}

export interface SourcePlugin<Config, Record> {
  readonly kind: string;
  read(
    config: Config,
    context: SourceContext,
  ): AsyncIterable<SourcePage<Record>>;
}

export interface NormalizeContext {
  sourceId: string;
  sourceAccount: string;
  defaultCurrency?: string;
  fetchedAt: string;
}

/** A provider-reported monetary value used to support transfer reconciliation. */
export interface TransferAmount {
  amount: string;
  currency: string;
}

/**
 * Optional provider-neutral evidence that a normalized record is a transfer.
 * The ingestion pipeline does not infer transfers from this alone; it is used
 * only to strengthen or validate a candidate produced from both account legs.
 */
export interface TransferEvidence {
  /** Provider counterpart account identifier, when the provider exposes one. */
  counterpartyAccountId?: string;
  /** Amount in the other side's/source currency for an FX transfer. */
  sourceAmount?: TransferAmount;
  /** Provider-reported rate between the transaction and source amount. */
  exchangeRate?: string;
  /** Explicit fee charged as part of the movement. */
  fee?: TransferAmount;
}

export interface NormalizedTransaction {
  sourceId: string;
  sourceAccount: string;
  externalId?: string;
  /** ISO calendar date, not a timestamp. */
  bookedAt: string;
  /** Signed decimal value for the source account. */
  amount: string;
  currency: string;
  merchant?: string;
  payee?: string;
  narration: string;
  status: "posted" | "pending";
  fetchedAt: string;
  tags?: readonly string[];
  links?: readonly string[];
  metadata: Record<string, string>;
  transferEvidence?: TransferEvidence;
}

/** Editable fields for review-import proposal patches. */
export type NormalizedTransactionPatch = Partial<
  Pick<
    NormalizedTransaction,
    | "bookedAt"
    | "amount"
    | "currency"
    | "merchant"
    | "payee"
    | "narration"
    | "tags"
    | "links"
    | "metadata"
  >
>;

export type NormalizeResult =
  | { ok: true; transaction: NormalizedTransaction }
  | { ok: false; message: string };

export interface NormalizerPlugin<Record> {
  readonly kind: string;
  normalize(record: Record, context: NormalizeContext): NormalizeResult;
}

export type CategoryMethod = "rule" | "history" | "recurring" | "ai" | "manual";

export type CategoryScoreKind =
  | "rule-certainty"
  | "history-frequency"
  | "recurrence-strength"
  | "ai-advisory"
  | "manual"
  | "legacy";

export interface CategoryEvidence {
  id: string;
  kind: CategoryMethod;
  summary: string;
  occurrences?: number;
  cadence?: "weekly" | "monthly" | "quarterly" | "yearly";
}

export interface CategorySuggestion {
  account: string;
  method: CategoryMethod;
  explanation: string;
  evidence: readonly CategoryEvidence[];
  /** Strategy-specific score. It is not a calibrated probability. */
  rawScore?: number;
  scoreKind?: CategoryScoreKind;
  support?: number;
  /** A deterministic signal that may suppress optional AI categorization. */
  hard?: boolean;
  /** Present only after a future calibration stage has produced a probability. */
  calibratedProbability?: number;
  /** @deprecated Use rawScore or calibratedProbability instead. */
  confidence?: number;
}

export interface MerchantAlias {
  value: string;
  normalizedValue: string;
  sourceId: string;
  confirmedAt: string;
}

export interface MerchantProvenance {
  source: "source" | "alias" | "ai" | "brandfetch" | "manual";
  provider?: string;
  model?: string;
  version?: string;
  observedAt: string;
}

export interface MerchantBrandAsset {
  filename: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  sha256: string;
  /** Pixel width/height requested from the Logo API. */
  size?: 40 | 120;
  /** The time after which the asset is eligible for a lazy refresh. */
  expiresAt: string;
}

export interface MerchantBrandData {
  provider: "brandfetch";
  brandId?: string;
  /** Time the current logo asset was last fetched. */
  fetchedAt: string;
  /** The next time the current logo may be refreshed. */
  expiresAt: string;
  asset?: MerchantBrandAsset;
}

export interface MerchantIdentity {
  merchantId: string;
  canonicalName: string;
  aliases: readonly MerchantAlias[];
  domain?: string;
  description?: string;
  industry?: string;
  countryCode?: string;
  provenance: readonly MerchantProvenance[];
  brand?: MerchantBrandData;
  /** An ephemeral, display-only URL supplied by a server-side resolver. */
  logoUrl?: string;
}

export interface MerchantCandidate {
  id: string;
  canonicalName: string;
  domain?: string;
  description?: string;
  industry?: string;
  countryCode?: string;
  rawScore?: number;
  explanation: string;
  provenance: readonly MerchantProvenance[];
  brand?: MerchantBrandData;
  /** An ephemeral, display-only URL supplied by a server-side resolver. */
  logoUrl?: string;
}

export type MerchantResolution =
  | {
      status: "confirmed";
      rawLabel: string;
      merchant: MerchantIdentity;
      explanation: string;
    }
  | {
      status: "suggested";
      rawLabel: string;
      candidates: readonly MerchantCandidate[];
      explanation: string;
    }
  | { status: "suppressed"; rawLabel: string; explanation: string }
  | { status: "unresolved"; rawLabel?: string; explanation?: string };

export interface MerchantResolutionContext {
  transaction: NormalizedTransaction;
  resolution: MerchantResolution;
  signal?: AbortSignal;
}

/** A sequential, provider-neutral merchant resolver. */
export interface MerchantResolverPlugin {
  readonly id: string;
  resolve(
    context: MerchantResolutionContext,
  ): Promise<MerchantResolution | undefined>;
}

export interface HistoricalSample {
  sourceAccount: string;
  merchant: string;
  merchantId?: string;
  category: string;
  amount: string;
  bookedAt: string;
}

export interface CategorizationContext {
  transaction: NormalizedTransaction;
  /** Present only when a user-confirmed merchant profile matched. */
  merchant?: MerchantIdentity;
  history: readonly HistoricalSample[];
  availableAccounts: readonly string[];
  /** Suggestions emitted by earlier deterministic categorizers in this run. */
  priorSuggestions?: readonly CategorySuggestion[];
}

export interface CategorizerPlugin {
  readonly id: string;
  /** AI categorization is deferred until deterministic evidence is weak or conflicted. */
  readonly isAi?: boolean;
  suggest(
    context: CategorizationContext,
  ): Promise<readonly CategorySuggestion[]>;
}

export type ProposalStatus =
  | "ready"
  | "needs-review"
  /** Written to the ledger and retained as an immutable import audit record. */
  | "accepted"
  | "duplicate"
  | "invalid"
  | "held"
  | "excluded";

/** One Codex/AI call captured during enrichment for later review. */
export interface AiEnrichmentCallRecord {
  id: string;
  label: string;
  prompt: string;
  response?: string;
  error?: string;
  ok: boolean;
  at: string;
}

/** Latest AI enrichment attempt for a proposal (persisted on the import run). */
export interface AiEnrichmentSnapshot {
  at: string;
  source: "enrich" | "ai-rerun" | "ingest";
  jobId?: string;
  ok: boolean;
  calls: readonly AiEnrichmentCallRecord[];
}

/** Ledger write that completed an import proposal. */
export interface ProposalAcceptance {
  acceptedAt: string;
  destinationPath: string;
  ledgerRevision: string;
}

export interface ImportProposal {
  id: string;
  importId: string;
  transaction?: NormalizedTransaction;
  /**
   * Original provider record before normalization (for Workflow review).
   * Not retained on the normalized transaction itself.
   */
  sourceRecord?: JsonRecord;
  merchantResolution?: MerchantResolution;
  suggestions: readonly CategorySuggestion[];
  selectedAccount?: string;
  status: ProposalStatus;
  duplicateOf?: string;
  /** Present once this proposal has been written to the ledger. */
  acceptance?: ProposalAcceptance;
  issues: readonly string[];
  /** Last AI enrichment attempt (prompts, responses, and errors). */
  lastAiEnrichment?: AiEnrichmentSnapshot;
}

export interface PipelineContext {
  availableAccounts: readonly string[];
  history: readonly HistoricalSample[];
}

export interface ProposalHook {
  process(
    proposal: ImportProposal,
    context: PipelineContext,
  ): Promise<ImportProposal>;
}

export type IngestionProgressStage =
  | "account"
  | "fetch"
  | "process"
  | "complete";

/** Optional progress callbacks for long-running ingest fetches. */
export interface IngestionProgress {
  stage: IngestionProgressStage;
  message: string;
  accountIndex?: number;
  accountTotal?: number;
  accountName?: string;
  pagesFetched?: number;
  seen?: number;
  imported?: number;
}

export interface IngestionRequest<Config, Record> {
  source: SourcePlugin<Config, Record>;
  sourceConfig: Config;
  sourceId: string;
  sourceAccount: string;
  normalizer: NormalizerPlugin<Record>;
  categorizers?: readonly CategorizerPlugin[];
  merchantResolvers?: readonly MerchantResolverPlugin[];
  hooks?: readonly ProposalHook[];
  history?: readonly HistoricalSample[];
  availableAccounts?: readonly string[];
  existingImportIds?: ReadonlySet<string>;
  existingFingerprints?: ReadonlySet<string>;
  /** Exact provider identities already imported by another connection. */
  existingProviderImportIds?: ReadonlySet<string>;
  /** Supplies a provider-scoped identity for safe cross-connection repeats. */
  providerImportIdentity?: (
    transaction: NormalizedTransaction,
  ) => string | undefined;
  cursor?: string;
  defaultCurrency?: string;
  fetchedAt?: string;
  sourceContext?: Omit<SourceContext, "sourceId" | "cursor">;
  onProgress?: (progress: IngestionProgress) => void | Promise<void>;
}

export interface IngestionRun {
  id: string;
  sourceId: string;
  startedAt: string;
  completedAt: string;
  cursor?: string;
  proposals: readonly ImportProposal[];
  /** AI calls made while this source was initially ingested. */
  audit?: {
    ai: readonly AiEnrichmentCallRecord[];
  };
  summary: {
    total: number;
    ready: number;
    needsReview: number;
    accepted: number;
    duplicates: number;
    invalid: number;
    held: number;
    excluded: number;
  };
}
