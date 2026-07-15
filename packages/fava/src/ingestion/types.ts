import type {
  ImportProposal,
  IngestionRun,
  JsonApiSourceConfig,
  JsonMappingConfig,
  MerchantRule,
} from "@beancount-js/beangulp";
import type { MerchantEnrichmentConfig } from "@beancount-js/server";

export interface IngestionSource {
  id: string;
  name: string;
  kind: "json-api";
  sourceAccount: string;
  destinationPath?: string;
  defaultCurrency?: string;
  allowedAccountRoots?: string[];
  aiEnabled?: boolean;
  merchantEnrichment?: MerchantEnrichmentConfig;
  api: JsonApiSourceConfig;
  mapping: JsonMappingConfig;
  rules: MerchantRule[];
  credentialAvailable?: boolean;
  merchantCredentialAvailable?: boolean;
  allowedAccounts?: string[];
}

export interface IngestionConfigResponse {
  version: 1;
  sources: IngestionSource[];
  accounts: string[];
}

export type { ImportProposal, IngestionRun };
