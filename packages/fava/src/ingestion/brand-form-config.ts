import { createFormConfig, type FormConfig } from "@beancount-js/forms";
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
