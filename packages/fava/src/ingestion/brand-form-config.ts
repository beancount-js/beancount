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
      clientId: DEFAULT_BRANDFETCH_CLIENT_ID,
      delivery: "local-cache",
      refreshDays: 30,
      highResolution: false,
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
      label: "Brand logos",
      ariaLabel: "Configure Brandfetch Logo API",
      get: (config) => Boolean(config.brandfetch),
      set: (config, enabled) =>
        withBrandfetch(
          config,
          enabled
            ? {
                enabled: false,
                clientId: DEFAULT_BRANDFETCH_CLIENT_ID,
                delivery: "local-cache",
                refreshDays: 30,
                highResolution: false,
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
      label: "Enable Brandfetch Logo API",
      ariaLabel: "Enable Brandfetch Logo API",
      get: (config) => config.brandfetch?.enabled === true,
      set: (config, enabled) =>
        withBrandfetch(config, { ...currentBrandfetch(config), enabled }),
    }),
    segmentedField({
      id: "ingestion-global-brandfetch-delivery",
      label: "Logo delivery",
      path: "brandfetch.delivery",
      as: "div",
      align: "center",
      options: [
        { value: "local-cache", label: "Local cache" },
        { value: "server-proxy", label: "Server proxy" },
      ],
      get: (config) =>
        config.brandfetch?.delivery === "server-proxy"
          ? "server-proxy"
          : "local-cache",
      set: (config, delivery) =>
        withBrandfetch(config, {
          ...currentBrandfetch(config),
          delivery:
            delivery === "server-proxy" ? "server-proxy" : "local-cache",
        }),
    }),
    switchField({
      id: "ingestion-global-brandfetch-high-resolution",
      label: "High-resolution logos",
      ariaLabel: "Enable high-resolution logos",
      get: (config) => config.brandfetch?.highResolution === true,
      set: (config, highResolution) =>
        withBrandfetch(config, {
          ...currentBrandfetch(config),
          highResolution,
        }),
    }),
    secretField({
      id: "ingestion-global-brandfetch-client-id",
      label: "Client ID",
      path: "brandfetch.clientId",
      ariaLabel: "Brandfetch Logo API client ID",
      envPlaceholder: "BRANDFETCH_CLIENT_ID",
      get: (config) => brandfetchClientId(config.brandfetch?.clientId),
      set: (config, clientId) =>
        withBrandfetch(config, {
          ...currentBrandfetch(config),
          clientId: brandfetchClientId(clientId),
        }),
    }),
  ],
});

export const brandSettingsLocalCacheForm: FormConfig<
  EditableIngestionConfig,
  SourceFormContext
> = createFormConfig({
  id: "ingestion-brand-settings-local-cache",
  fields: [
    textField({
      id: "ingestion-global-brandfetch-refresh-days",
      label: "Refresh after days",
      path: "brandfetch.refreshDays",
      inputType: "number",
      placeholder: "30",
      as: "div",
      align: "center",
      get: (config) => String(config.brandfetch?.refreshDays ?? 30),
      set: (config, value) => {
        const parsed = Number(value);
        return withBrandfetch(config, {
          ...currentBrandfetch(config),
          refreshDays: Number.isInteger(parsed) ? parsed : 0,
        });
      },
    }),
  ],
});
