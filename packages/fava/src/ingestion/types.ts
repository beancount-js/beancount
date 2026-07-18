import type {
  AiEnrichmentCallRecord,
  AiEnrichmentSnapshot,
  ImportProposal,
  IngestionRun,
  JsonApiLinkedAccount,
  JsonApiSourceConfig,
  JsonMappingConfig,
  MerchantRule,
  ProviderCategoryMapping,
} from "@beancount-js/beangulp";
import type {
  AiEnrichmentDebug,
  AiEnrichmentDebugCall,
  BrandfetchEnrichmentConfig,
  MerchantEnrichmentConfig,
  IngestionRunPage,
  IngestionRunSummary,
  IngestionReconciliationConfig,
  IngestionReviewLedgerSnapshot,
} from "@beancount-js/server";

export type {
  AiEnrichmentCallRecord,
  AiEnrichmentDebug,
  AiEnrichmentDebugCall,
  AiEnrichmentSnapshot,
  BrandfetchEnrichmentConfig,
  IngestionReconciliationConfig,
  IngestionReviewLedgerSnapshot,
};

export interface IngestionSource {
  id: string;
  name: string;
  kind: string;
  /** Optional project merchant used to present this connection in the UI. */
  merchantId?: string;
  /**
   * Beancount asset account for standalone sources. Grouped connections use
   * nested `accounts[]` instead.
   */
  sourceAccount?: string;
  destinationPath?: string;
  defaultCurrency?: string;
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
  /** Connector-owned config for registered kinds. */
  config?: unknown;
  rules: MerchantRule[];
  /** Connection-level mappings from provider category codes to ledger accounts. */
  providerCategoryMappings?: ProviderCategoryMapping[];
  /** Nested bank accounts for multi-account providers (e.g. Lunch Flow). */
  accounts?: JsonApiLinkedAccount[];
  credentialAvailable?: boolean;
  merchantCredentialAvailable?: boolean;
  allowedAccounts?: string[];
}

export interface IngestionConfigResponse {
  version: 1 | 2 | 3;
  brandfetch?: BrandfetchEnrichmentConfig;
  reconciliation?: IngestionReconciliationConfig;
  sources: IngestionSource[];
  accounts: string[];
  brandCredentialAvailable?: boolean;
}

export type {
  ImportProposal,
  IngestionRun,
  IngestionRunPage,
  IngestionRunSummary,
  JsonApiLinkedAccount,
};
