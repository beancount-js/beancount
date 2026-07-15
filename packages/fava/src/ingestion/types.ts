import type {
  ImportProposal,
  IngestionRun,
  JsonApiLinkedAccount,
  JsonApiSourceConfig,
  JsonMappingConfig,
  MerchantRule,
} from "@beancount-js/beangulp";
import type { MerchantEnrichmentConfig } from "@beancount-js/server";

export interface IngestionSource {
  id: string;
  name: string;
  kind: "json-api";
  /**
   * Beancount asset account for standalone sources.
   * Grouped connections use nested `accounts[]` instead.
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
  credentialAvailable?: boolean;
  merchantCredentialAvailable?: boolean;
  allowedAccounts?: string[];
}

export interface IngestionConfigResponse {
  version: 1;
  sources: IngestionSource[];
  accounts: string[];
}

export type { ImportProposal, IngestionRun, JsonApiLinkedAccount };
