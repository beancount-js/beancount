import {
  createFormConfig,
  customViewField,
  segmentedField,
  textField,
  textareaField,
  type FormConfig,
  type FormCustomRenderer,
} from "@beancount-js/forms";
import type { MerchantRule } from "@beancount-js/beangulp";
import type { EditableIngestionSource } from "./source-form";
import AccountComboField from "../components/form/AccountComboField.svelte";
import SecretField from "../components/form/SecretField.svelte";
import SwitchField from "../components/form/SwitchField.svelte";

export type SourceFormContext = {
  accounts: string[];
  credentialAvailable?: boolean;
  merchantCredentialAvailable?: boolean;
};

function optionalString(value: string) {
  const next = value.trim();
  return next || undefined;
}

function joinList(value: string[] | undefined) {
  return (value ?? []).join(", ");
}

function parseList(value: string) {
  const list = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}

export function accountField<TRoot>(config: {
  id: string;
  label: string;
  placeholder?: string;
  get: (root: TRoot, context: SourceFormContext) => string;
  set: (root: TRoot, value: string, context: SourceFormContext) => TRoot;
}) {
  return customViewField<TRoot, SourceFormContext, string>({
    ...config,
    component: AccountComboField as FormCustomRenderer<
      TRoot,
      SourceFormContext,
      string
    >,
    view: "edit",
    wrapper: "field",
    as: "div",
    align: "center",
    placeholder: config.placeholder ?? "Select account",
  });
}

export function switchField<TRoot>(config: {
  id: string;
  label: string;
  ariaLabel?: string;
  get: (root: TRoot, context: SourceFormContext) => boolean;
  set: (root: TRoot, value: boolean, context: SourceFormContext) => TRoot;
}) {
  return customViewField<TRoot, SourceFormContext, boolean>({
    ...config,
    component: SwitchField as FormCustomRenderer<
      TRoot,
      SourceFormContext,
      boolean
    >,
    view: "edit",
    wrapper: "field",
    as: "div",
    align: "center",
  });
}

export function secretField<TRoot>(config: {
  id: string;
  label: string;
  path?: string;
  ariaLabel?: string;
  get: (root: TRoot, context: SourceFormContext) => string;
  set: (root: TRoot, value: string, context: SourceFormContext) => TRoot;
}) {
  return customViewField<TRoot, SourceFormContext, string>({
    ...config,
    component: SecretField as FormCustomRenderer<
      TRoot,
      SourceFormContext,
      string
    >,
    view: "edit",
    wrapper: "field",
    as: "div",
    align: "start",
  });
}

export const sourceDetailsForm = createFormConfig<
  EditableIngestionSource,
  SourceFormContext
>({
  id: "ingestion-source-details",
  fields: [
    textField({
      id: "id",
      label: "Identifier",
      path: "id",
      get: (source) => source.id,
      set: (source, id) => ({ ...source, id }),
    }),
    accountField({
      id: "sourceAccount",
      label: "Source account",
      get: (source) => source.sourceAccount ?? "",
      set: (source, sourceAccount) => ({ ...source, sourceAccount }),
    }),
    textField({
      id: "destinationPath",
      label: "Destination file",
      placeholder: "Project entry file",
      get: (source) => source.destinationPath ?? "",
      set: (source, destinationPath) => ({
        ...source,
        destinationPath: optionalString(destinationPath),
      }),
    }),
    textField({
      id: "defaultCurrency",
      label: "Default currency",
      placeholder: "GBP",
      get: (source) => source.defaultCurrency ?? "",
      set: (source, defaultCurrency) => ({
        ...source,
        defaultCurrency: optionalString(defaultCurrency)?.toUpperCase(),
      }),
    }),
    textField({
      id: "allowedAccountRoots",
      label: "Allowed account roots",
      placeholder: "Expenses, Income",
      get: (source) => joinList(source.allowedAccountRoots),
      set: (source, value) => ({
        ...source,
        allowedAccountRoots: parseList(value),
      }),
    }),
    textareaField({
      id: "setup",
      label: "Setup guide",
      path: "setup",
      placeholder:
        "Markdown shown in connection preview. Leave blank for the default guide.",
      get: (source) => source.setup ?? "",
      set: (source, setup) => ({
        ...source,
        setup: optionalString(setup),
      }),
    }),
  ],
});

/** Connection-level details for multi-account providers (no top-level sourceAccount). */
export const sourceDetailsGroupedForm = createFormConfig<
  EditableIngestionSource,
  SourceFormContext
>({
  id: "ingestion-source-details-grouped",
  fields: sourceDetailsForm.fields.filter((field) => field.id !== "sourceAccount"),
});

export const sourceApiForm = createFormConfig<
  EditableIngestionSource,
  SourceFormContext
>({
  id: "ingestion-source-api",
  fields: [
    textField({
      id: "api.endpoint",
      label: "Endpoint",
      inputType: "url",
      path: "api.endpoint",
      placeholder: "https://api.example.com/transactions",
      get: (source) => source.api.endpoint ?? "",
      set: (source, endpoint) => ({
        ...source,
        api: { ...source.api, endpoint: optionalString(endpoint) },
      }),
    }),
    secretField({
      id: "api.secretRef",
      label: "API key",
      path: "api.secretRef",
      ariaLabel: "API key",
      get: (source) => source.api.secretRef,
      set: (source, secretRef) => ({
        ...source,
        api: { ...source.api, secretRef },
      }),
    }),
    segmentedField({
      id: "api.authScheme",
      label: "Auth header",
      path: "api.authScheme",
      options: [
        { value: "bearer", label: "Bearer" },
        { value: "x-api-key", label: "X-API-Key" },
      ],
      get: (source) => source.api.authScheme ?? "bearer",
      set: (source, authScheme) => ({
        ...source,
        api: {
          ...source.api,
          authScheme:
            authScheme === "x-api-key"
              ? "x-api-key"
              : authScheme === "bearer"
                ? "bearer"
                : undefined,
        },
      }),
    }),
    textField({
      id: "api.recordsPath",
      label: "Records path",
      path: "api.recordsPath",
      placeholder: "transactions",
      get: (source) => source.api.recordsPath ?? "",
      set: (source, recordsPath) => ({
        ...source,
        api: { ...source.api, recordsPath: optionalString(recordsPath) },
      }),
    }),
    textField({
      id: "api.allowedHosts",
      label: "Allowed hosts",
      path: "api.allowedHosts",
      placeholder: "api.example.com",
      get: (source) => joinList(source.api.allowedHosts),
      set: (source, value) => ({
        ...source,
        api: { ...source.api, allowedHosts: parseList(value) },
      }),
    }),
    switchField({
      id: "api.pagination",
      label: "Cursor pagination",
      ariaLabel: "Configure cursor pagination",
      get: (source) => Boolean(source.api.pagination),
      set: (source, enabled) => ({
        ...source,
        api: {
          ...source.api,
          pagination: enabled
            ? { cursorQueryParam: "cursor", nextCursorPath: "next_cursor" }
            : undefined,
        },
      }),
    }),
  ],
});

export const sourceApiGroupedForm = createFormConfig<
  EditableIngestionSource,
  SourceFormContext
>({
  id: "ingestion-source-api-grouped",
  fields: [
    textField({
      id: "api.baseUrl",
      label: "Base URL",
      inputType: "url",
      path: "api.baseUrl",
      placeholder: "https://lunchflow.app/api/v1",
      get: (source) => source.api.baseUrl ?? "",
      set: (source, baseUrl) => ({
        ...source,
        api: { ...source.api, baseUrl: optionalString(baseUrl) },
      }),
    }),
    ...sourceApiForm.fields.filter((field) => field.id !== "api.endpoint"),
  ],
});
export const sourcePaginationForm = createFormConfig<
  EditableIngestionSource,
  SourceFormContext
>({
  id: "ingestion-source-pagination",
  fields: [
    textField({
      id: "ingestion-pagination-cursor",
      label: "Cursor parameter",
      get: (source) => source.api.pagination?.cursorQueryParam ?? "",
      set: (source, cursorQueryParam) => ({
        ...source,
        api: {
          ...source.api,
          pagination: {
            cursorQueryParam,
            nextCursorPath: source.api.pagination?.nextCursorPath ?? "",
          },
        },
      }),
    }),
    textField({
      id: "ingestion-pagination-next",
      label: "Next cursor path",
      get: (source) => source.api.pagination?.nextCursorPath ?? "",
      set: (source, nextCursorPath) => ({
        ...source,
        api: {
          ...source.api,
          pagination: {
            cursorQueryParam: source.api.pagination?.cursorQueryParam ?? "",
            nextCursorPath,
          },
        },
      }),
    }),
  ],
});

const mappingFields = [
  { key: "id", label: "Import ID" },
  { key: "date", label: "Date" },
  { key: "amount", label: "Amount" },
  { key: "currency", label: "Currency" },
  { key: "merchant", label: "Merchant" },
  { key: "payee", label: "Payee" },
  { key: "narration", label: "Narration" },
  { key: "status", label: "Status" },
  { key: "dateFormat", label: "Date format" },
] as const;

export const sourceMappingForm = createFormConfig<
  EditableIngestionSource,
  SourceFormContext
>({
  id: "ingestion-source-mapping",
  fields: [
    ...mappingFields.map((field) =>
      textField<EditableIngestionSource, SourceFormContext>({
        id: `mapping.${field.key}`,
        label: field.label,
        path: `mapping.${field.key}`,
        get: (source) => source.mapping[field.key] ?? "",
        set: (source, value) => ({
          ...source,
          mapping: {
            ...source.mapping,
            [field.key]: optionalString(value),
          },
        }),
      }),
    ),
    segmentedField({
      id: "mapping.amountSign",
      label: "Amount sign",
      options: [
        { value: "as-is", label: "As-is" },
        { value: "invert", label: "Invert" },
      ],
      get: (source) => source.mapping.amountSign ?? "as-is",
      set: (source, amountSign) => ({
        ...source,
        mapping: {
          ...source.mapping,
          amountSign:
            amountSign === "invert"
              ? "invert"
              : amountSign === "as-is"
                ? undefined
                : undefined,
        },
      }),
    }),
  ],
});

export function createRuleForm(
  index: number,
): FormConfig<MerchantRule, SourceFormContext> {
  return createFormConfig<MerchantRule, SourceFormContext>({
    id: `ingestion-rule-${index}`,
    fields: [
      textField({
        id: `ingestion-rule-${index}-merchant-id`,
        label: "Merchant ID",
        get: (rule) => rule.merchantId ?? "",
        set: (rule, merchantId) => ({
          ...rule,
          merchantId: optionalString(merchantId),
        }),
      }),
      accountField({
        id: `ingestion-rule-${index}-account`,
        label: "Category account",
        get: (rule) => rule.account,
        set: (rule, account) => ({ ...rule, account }),
      }),
      accountField({
        id: `ingestion-rule-${index}-source-account`,
        label: "Match source account",
        get: (rule) => rule.sourceAccount ?? "",
        set: (rule, sourceAccount) => ({
          ...rule,
          sourceAccount: optionalString(sourceAccount),
        }),
      }),
      segmentedField({
        id: `ingestion-rule-${index}-direction`,
        label: "Direction",
        options: [
          { value: "any", label: "Any direction" },
          { value: "debit", label: "Debit" },
          { value: "credit", label: "Credit" },
        ],
        get: (rule) => rule.direction ?? "any",
        set: (rule, direction) => ({
          ...rule,
          direction:
            direction === "debit" || direction === "credit"
              ? direction
              : undefined,
        }),
      }),
    ],
  });
}

export const sourceEnrichmentForm = createFormConfig<
  EditableIngestionSource,
  SourceFormContext
>({
  id: "ingestion-source-enrichment",
  fields: [
    switchField({
      id: "ingestion-ai-enabled",
      label: "AI categorisation",
      ariaLabel: "Enable AI categorisation",
      get: (source) => source.aiEnabled === true,
      set: (source, aiEnabled) => ({
        ...source,
        aiEnabled: aiEnabled || undefined,
      }),
    }),
    switchField({
      id: "ingestion-merchant-enrichment",
      label: "Merchant enrichment",
      ariaLabel: "Configure merchant enrichment",
      get: (source) => Boolean(source.merchantEnrichment),
      set: (source, enabled) => ({
        ...source,
        merchantEnrichment: enabled ? { enabled: false } : undefined,
      }),
    }),
  ],
});

export const sourceEnrichmentDetailsForm = createFormConfig<
  EditableIngestionSource,
  SourceFormContext
>({
  id: "ingestion-source-enrichment-details",
  fields: [
    switchField({
      id: "ingestion-enrichment-enabled",
      label: "Enable enrichment",
      ariaLabel: "Enable merchant enrichment",
      get: (source) => source.merchantEnrichment?.enabled === true,
      set: (source, enabled) => ({
        ...source,
        merchantEnrichment: {
          ...(source.merchantEnrichment ?? { enabled: false }),
          enabled,
        },
      }),
    }),
    switchField({
      id: "ingestion-enrichment-ai",
      label: "Use AI for enrichment",
      ariaLabel: "Enable AI merchant enrichment",
      get: (source) => source.merchantEnrichment?.aiEnabled === true,
      set: (source, aiEnabled) => ({
        ...source,
        merchantEnrichment: {
          ...(source.merchantEnrichment ?? { enabled: false }),
          aiEnabled: aiEnabled || undefined,
        },
      }),
    }),
    textField({
      id: "merchantEnrichment.countryCode",
      label: "Country code",
      path: "merchantEnrichment.countryCode",
      placeholder: "GB",
      get: (source) => source.merchantEnrichment?.countryCode ?? "",
      set: (source, countryCode) => ({
        ...source,
        merchantEnrichment: {
          ...(source.merchantEnrichment ?? { enabled: false }),
          countryCode: optionalString(countryCode)?.toUpperCase(),
        },
      }),
    }),
    switchField({
      id: "ingestion-brandfetch-toggle",
      label: "Brandfetch",
      ariaLabel: "Configure Brandfetch",
      get: (source) => Boolean(source.merchantEnrichment?.brandfetch),
      set: (source, enabled) => ({
        ...source,
        merchantEnrichment: {
          ...(source.merchantEnrichment ?? { enabled: false }),
          brandfetch: enabled
            ? {
                enabled: false,
                apiKeySecretRef: "env:BRANDFETCH_API_KEY",
                assetMode: "hotlink",
              }
            : undefined,
        },
      }),
    }),
  ],
});

export const sourceBrandfetchForm = createFormConfig<
  EditableIngestionSource,
  SourceFormContext
>({
  id: "ingestion-source-brandfetch",
  fields: [
    switchField({
      id: "ingestion-brandfetch-enabled",
      label: "Enable Brandfetch",
      ariaLabel: "Enable Brandfetch",
      get: (source) => source.merchantEnrichment?.brandfetch?.enabled === true,
      set: (source, enabled) => ({
        ...source,
        merchantEnrichment: {
          ...(source.merchantEnrichment ?? { enabled: false }),
          brandfetch: {
            enabled,
            apiKeySecretRef:
              source.merchantEnrichment?.brandfetch?.apiKeySecretRef ??
              "env:BRANDFETCH_API_KEY",
            assetMode:
              source.merchantEnrichment?.brandfetch?.assetMode ?? "hotlink",
            allowNameSearch:
              source.merchantEnrichment?.brandfetch?.allowNameSearch,
            allowTransactionLookup:
              source.merchantEnrichment?.brandfetch?.allowTransactionLookup,
            cacheContentAllowed:
              source.merchantEnrichment?.brandfetch?.cacheContentAllowed,
            clientId: source.merchantEnrichment?.brandfetch?.clientId,
            ttlDays: source.merchantEnrichment?.brandfetch?.ttlDays,
          },
        },
      }),
    }),
    switchField({
      id: "ingestion-brandfetch-name-search",
      label: "Allow name search",
      ariaLabel: "Allow Brandfetch name search",
      get: (source) =>
        source.merchantEnrichment?.brandfetch?.allowNameSearch === true,
      set: (source, allowNameSearch) => ({
        ...source,
        merchantEnrichment: {
          ...(source.merchantEnrichment ?? { enabled: false }),
          brandfetch: {
            enabled: source.merchantEnrichment?.brandfetch?.enabled ?? false,
            apiKeySecretRef:
              source.merchantEnrichment?.brandfetch?.apiKeySecretRef ??
              "env:BRANDFETCH_API_KEY",
            assetMode:
              source.merchantEnrichment?.brandfetch?.assetMode ?? "hotlink",
            allowNameSearch: allowNameSearch || undefined,
            allowTransactionLookup:
              source.merchantEnrichment?.brandfetch?.allowTransactionLookup,
            cacheContentAllowed:
              source.merchantEnrichment?.brandfetch?.cacheContentAllowed,
            clientId: source.merchantEnrichment?.brandfetch?.clientId,
            ttlDays: source.merchantEnrichment?.brandfetch?.ttlDays,
          },
        },
      }),
    }),
    switchField({
      id: "ingestion-brandfetch-txn-lookup",
      label: "Allow transaction lookup",
      ariaLabel: "Allow Brandfetch transaction lookup",
      get: (source) =>
        source.merchantEnrichment?.brandfetch?.allowTransactionLookup === true,
      set: (source, allowTransactionLookup) => ({
        ...source,
        merchantEnrichment: {
          ...(source.merchantEnrichment ?? { enabled: false }),
          brandfetch: {
            enabled: source.merchantEnrichment?.brandfetch?.enabled ?? false,
            apiKeySecretRef:
              source.merchantEnrichment?.brandfetch?.apiKeySecretRef ??
              "env:BRANDFETCH_API_KEY",
            assetMode:
              source.merchantEnrichment?.brandfetch?.assetMode ?? "hotlink",
            allowNameSearch:
              source.merchantEnrichment?.brandfetch?.allowNameSearch,
            allowTransactionLookup: allowTransactionLookup || undefined,
            cacheContentAllowed:
              source.merchantEnrichment?.brandfetch?.cacheContentAllowed,
            clientId: source.merchantEnrichment?.brandfetch?.clientId,
            ttlDays: source.merchantEnrichment?.brandfetch?.ttlDays,
          },
        },
      }),
    }),
    switchField({
      id: "ingestion-brandfetch-cache",
      label: "Allow content caching",
      ariaLabel: "Allow Brandfetch cache content",
      get: (source) =>
        source.merchantEnrichment?.brandfetch?.cacheContentAllowed === true,
      set: (source, cacheContentAllowed) => ({
        ...source,
        merchantEnrichment: {
          ...(source.merchantEnrichment ?? { enabled: false }),
          brandfetch: {
            enabled: source.merchantEnrichment?.brandfetch?.enabled ?? false,
            apiKeySecretRef:
              source.merchantEnrichment?.brandfetch?.apiKeySecretRef ??
              "env:BRANDFETCH_API_KEY",
            assetMode:
              source.merchantEnrichment?.brandfetch?.assetMode ?? "hotlink",
            allowNameSearch:
              source.merchantEnrichment?.brandfetch?.allowNameSearch,
            allowTransactionLookup:
              source.merchantEnrichment?.brandfetch?.allowTransactionLookup,
            cacheContentAllowed: cacheContentAllowed || undefined,
            clientId: source.merchantEnrichment?.brandfetch?.clientId,
            ttlDays: source.merchantEnrichment?.brandfetch?.ttlDays,
          },
        },
      }),
    }),
    secretField({
      id: "merchantEnrichment.brandfetch.apiKeySecretRef",
      label: "API key",
      path: "merchantEnrichment.brandfetch.apiKeySecretRef",
      ariaLabel: "Brandfetch API key",
      get: (source) =>
        source.merchantEnrichment?.brandfetch?.apiKeySecretRef ?? "",
      set: (source, apiKeySecretRef) => ({
        ...source,
        merchantEnrichment: {
          ...(source.merchantEnrichment ?? { enabled: false }),
          brandfetch: {
            enabled: source.merchantEnrichment?.brandfetch?.enabled ?? false,
            apiKeySecretRef,
            assetMode:
              source.merchantEnrichment?.brandfetch?.assetMode ?? "hotlink",
            allowNameSearch:
              source.merchantEnrichment?.brandfetch?.allowNameSearch,
            allowTransactionLookup:
              source.merchantEnrichment?.brandfetch?.allowTransactionLookup,
            cacheContentAllowed:
              source.merchantEnrichment?.brandfetch?.cacheContentAllowed,
            clientId: source.merchantEnrichment?.brandfetch?.clientId,
            ttlDays: source.merchantEnrichment?.brandfetch?.ttlDays,
          },
        },
      }),
    }),
    textField({
      id: "ingestion-brandfetch-client-id",
      label: "Client ID",
      get: (source) => source.merchantEnrichment?.brandfetch?.clientId ?? "",
      set: (source, clientId) => ({
        ...source,
        merchantEnrichment: {
          ...(source.merchantEnrichment ?? { enabled: false }),
          brandfetch: {
            enabled: source.merchantEnrichment?.brandfetch?.enabled ?? false,
            apiKeySecretRef:
              source.merchantEnrichment?.brandfetch?.apiKeySecretRef ??
              "env:BRANDFETCH_API_KEY",
            assetMode:
              source.merchantEnrichment?.brandfetch?.assetMode ?? "hotlink",
            allowNameSearch:
              source.merchantEnrichment?.brandfetch?.allowNameSearch,
            allowTransactionLookup:
              source.merchantEnrichment?.brandfetch?.allowTransactionLookup,
            cacheContentAllowed:
              source.merchantEnrichment?.brandfetch?.cacheContentAllowed,
            clientId: optionalString(clientId),
            ttlDays: source.merchantEnrichment?.brandfetch?.ttlDays,
          },
        },
      }),
    }),
    segmentedField({
      id: "ingestion-brandfetch-asset-mode",
      label: "Asset mode",
      options: [
        { value: "hotlink", label: "Hotlink" },
        { value: "cache", label: "Cache" },
      ],
      get: (source) =>
        source.merchantEnrichment?.brandfetch?.assetMode ?? "hotlink",
      set: (source, assetMode) => ({
        ...source,
        merchantEnrichment: {
          ...(source.merchantEnrichment ?? { enabled: false }),
          brandfetch: {
            enabled: source.merchantEnrichment?.brandfetch?.enabled ?? false,
            apiKeySecretRef:
              source.merchantEnrichment?.brandfetch?.apiKeySecretRef ??
              "env:BRANDFETCH_API_KEY",
            assetMode: (assetMode === "cache" ? "cache" : "hotlink") as
              | "hotlink"
              | "cache",
            allowNameSearch:
              source.merchantEnrichment?.brandfetch?.allowNameSearch,
            allowTransactionLookup:
              source.merchantEnrichment?.brandfetch?.allowTransactionLookup,
            cacheContentAllowed:
              source.merchantEnrichment?.brandfetch?.cacheContentAllowed,
            clientId: source.merchantEnrichment?.brandfetch?.clientId,
            ttlDays: source.merchantEnrichment?.brandfetch?.ttlDays,
          },
        },
      }),
    }),
    textField({
      id: "ingestion-brandfetch-ttl",
      label: "Cache TTL (days)",
      inputType: "number",
      get: (source) =>
        source.merchantEnrichment?.brandfetch?.ttlDays != null
          ? String(source.merchantEnrichment.brandfetch.ttlDays)
          : "",
      set: (source, value) => ({
        ...source,
        merchantEnrichment: {
          ...(source.merchantEnrichment ?? { enabled: false }),
          brandfetch: {
            enabled: source.merchantEnrichment?.brandfetch?.enabled ?? false,
            apiKeySecretRef:
              source.merchantEnrichment?.brandfetch?.apiKeySecretRef ??
              "env:BRANDFETCH_API_KEY",
            assetMode:
              source.merchantEnrichment?.brandfetch?.assetMode ?? "hotlink",
            allowNameSearch:
              source.merchantEnrichment?.brandfetch?.allowNameSearch,
            allowTransactionLookup:
              source.merchantEnrichment?.brandfetch?.allowTransactionLookup,
            cacheContentAllowed:
              source.merchantEnrichment?.brandfetch?.cacheContentAllowed,
            clientId: source.merchantEnrichment?.brandfetch?.clientId,
            ttlDays: value ? Number(value) : undefined,
          },
        },
      }),
    }),
  ],
});
