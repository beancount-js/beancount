import {
  createFormConfig,
  segmentedField,
  textField,
  type FormConfig,
} from "@beancount-js/forms";
import type { BrandfetchEnrichmentConfig } from "@beancount-js/server";
import {
  secretField,
  switchField,
  type SourceFormContext,
} from "./source-form-config";
import type { EditableIngestionConfig } from "./source-form";

const DEFAULT_BRANDFETCH_CLIENT_ID = "env:BRANDFETCH_CLIENT_ID";

function brandfetchClientId(value: string | undefined) {
  const next = value?.trim();
  return next || DEFAULT_BRANDFETCH_CLIENT_ID;
}

function withBrandfetch(
  config: EditableIngestionConfig,
  brandfetch: BrandfetchEnrichmentConfig | undefined,
): EditableIngestionConfig {
  return { ...config, brandfetch };
}

function currentBrandfetch(
  config: EditableIngestionConfig,
): BrandfetchEnrichmentConfig {
  return (
    config.brandfetch ?? {
      enabled: false,
      apiKeySecretRef: "env:BRANDFETCH_API_KEY",
      clientId: DEFAULT_BRANDFETCH_CLIENT_ID,
      assetMode: "hotlink",
    }
  );
}

export const brandSettingsToggleForm = createFormConfig<
  EditableIngestionConfig,
  SourceFormContext
>({
  id: "ingestion-brand-settings-toggle",
  fields: [
    switchField({
      id: "ingestion-global-brandfetch-toggle",
      label: "Brand matching",
      ariaLabel: "Configure brand matching",
      get: (config) => Boolean(config.brandfetch),
      set: (config, enabled) =>
        withBrandfetch(
          config,
          enabled
            ? {
                enabled: false,
                apiKeySecretRef: "env:BRANDFETCH_API_KEY",
                clientId: DEFAULT_BRANDFETCH_CLIENT_ID,
                assetMode: "hotlink",
              }
            : undefined,
        ),
    }),
  ],
});

export const brandSettingsForm: FormConfig<
  EditableIngestionConfig,
  SourceFormContext
> = createFormConfig({
  id: "ingestion-brand-settings",
  fields: [
    switchField({
      id: "ingestion-global-brandfetch-enabled",
      label: "Enable Brandfetch",
      ariaLabel: "Enable Brandfetch",
      get: (config) => config.brandfetch?.enabled === true,
      set: (config, enabled) =>
        withBrandfetch(config, { ...currentBrandfetch(config), enabled }),
    }),
    switchField({
      id: "ingestion-global-brandfetch-name-search",
      label: "Allow name search",
      ariaLabel: "Allow Brandfetch name search",
      get: (config) => config.brandfetch?.allowNameSearch === true,
      set: (config, allowNameSearch) =>
        withBrandfetch(config, {
          ...currentBrandfetch(config),
          allowNameSearch: allowNameSearch || undefined,
        }),
    }),
    switchField({
      id: "ingestion-global-brandfetch-txn-lookup",
      label: "Allow transaction lookup",
      ariaLabel: "Allow Brandfetch transaction lookup",
      get: (config) => config.brandfetch?.allowTransactionLookup === true,
      set: (config, allowTransactionLookup) =>
        withBrandfetch(config, {
          ...currentBrandfetch(config),
          allowTransactionLookup: allowTransactionLookup || undefined,
        }),
    }),
    switchField({
      id: "ingestion-global-brandfetch-cache",
      label: "Allow content caching",
      ariaLabel: "Allow Brandfetch cache content",
      get: (config) => config.brandfetch?.cacheContentAllowed === true,
      set: (config, cacheContentAllowed) =>
        withBrandfetch(config, {
          ...currentBrandfetch(config),
          cacheContentAllowed: cacheContentAllowed || undefined,
        }),
    }),
    secretField({
      id: "brandfetch.apiKeySecretRef",
      label: "API key",
      path: "brandfetch.apiKeySecretRef",
      ariaLabel: "Brandfetch API key",
      envPlaceholder: "BRANDFETCH_API_KEY",
      get: (config) => config.brandfetch?.apiKeySecretRef ?? "",
      set: (config, apiKeySecretRef) =>
        withBrandfetch(config, {
          ...currentBrandfetch(config),
          apiKeySecretRef,
        }),
    }),
    secretField({
      id: "ingestion-global-brandfetch-client-id",
      label: "Client ID",
      path: "brandfetch.clientId",
      ariaLabel: "Brandfetch client ID",
      envPlaceholder: "BRANDFETCH_CLIENT_ID",
      get: (config) => brandfetchClientId(config.brandfetch?.clientId),
      set: (config, clientId) =>
        withBrandfetch(config, {
          ...currentBrandfetch(config),
          clientId: brandfetchClientId(clientId),
        }),
    }),
    segmentedField({
      id: "ingestion-global-brandfetch-asset-mode",
      label: "Asset mode",
      options: [
        { value: "hotlink", label: "Hotlink" },
        { value: "cache", label: "Cache" },
      ],
      get: (config) => config.brandfetch?.assetMode ?? "hotlink",
      set: (config, assetMode) =>
        withBrandfetch(config, {
          ...currentBrandfetch(config),
          assetMode: (assetMode === "cache" ? "cache" : "hotlink") as
            | "hotlink"
            | "cache",
        }),
    }),
    textField({
      id: "ingestion-global-brandfetch-ttl",
      label: "Cache TTL (days)",
      inputType: "number",
      get: (config) =>
        config.brandfetch?.ttlDays != null
          ? String(config.brandfetch.ttlDays)
          : "",
      set: (config, value) =>
        withBrandfetch(config, {
          ...currentBrandfetch(config),
          ttlDays: value ? Number(value) : undefined,
        }),
    }),
  ],
});
