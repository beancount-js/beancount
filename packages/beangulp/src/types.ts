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
  metadata: Record<string, string>;
}

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
  expiresAt: string;
}

export interface MerchantBrandData {
  provider: "brandfetch";
  brandId?: string;
  fetchedAt: string;
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
  | "duplicate"
  | "invalid"
  | "held";

export interface ImportProposal {
  id: string;
  importId: string;
  transaction?: NormalizedTransaction;
  merchantResolution?: MerchantResolution;
  suggestions: readonly CategorySuggestion[];
  selectedAccount?: string;
  status: ProposalStatus;
  duplicateOf?: string;
  issues: readonly string[];
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
  cursor?: string;
  defaultCurrency?: string;
  fetchedAt?: string;
  sourceContext?: Omit<SourceContext, "sourceId" | "cursor">;
}

export interface IngestionRun {
  id: string;
  sourceId: string;
  startedAt: string;
  completedAt: string;
  cursor?: string;
  proposals: readonly ImportProposal[];
  summary: {
    total: number;
    ready: number;
    needsReview: number;
    duplicates: number;
    invalid: number;
    held: number;
  };
}
