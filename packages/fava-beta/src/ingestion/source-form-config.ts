import {
  createFormConfig,
  customViewField,
  segmentedField,
  textField,
  textareaField,
  type FormCustomRenderer,
} from "@beancount-js/forms";
import { type MerchantPickerMerchant } from "@beancount-js/ui/forms";
import type { EditableIngestionSource } from "./source-form";
import {
  AccountComboField,
  MerchantComboField,
  SecretField,
  SwitchField,
} from "@beancount-js/ui/forms";

export type SourceFormContext = {
  accounts: string[];
  projectId?: string;
  merchants?: readonly MerchantPickerMerchant[];
  /** Key names from the project-root `.env` (values never included). */
  envKeys?: string[];
  credentialAvailable?: boolean;
  merchantCredentialAvailable?: boolean;
};

function optionalString(value: string) {
  const next = value.trim();
  return next || undefined;
}

function mappingFor(source: EditableIngestionSource) {
  return {
    ...source.mapping,
    date: source.mapping?.date ?? "",
    amount: source.mapping?.amount ?? "",
  };
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

function optionalPriority(value: string) {
  const clean = value.trim();
  if (!clean) return undefined;
  const parsed = Number(clean);
  return Number.isInteger(parsed) ? parsed : undefined;
}

const defaultReviewDateFormat = "YYYY-MM";

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

function merchantField<TRoot>(config: {
  id: string;
  label: string;
  get: (root: TRoot, context: SourceFormContext) => string;
  set: (root: TRoot, value: string, context: SourceFormContext) => TRoot;
}) {
  return customViewField<TRoot, SourceFormContext, string>({
    ...config,
    component: MerchantComboField as FormCustomRenderer<
      TRoot,
      SourceFormContext,
      string
    >,
    view: "edit",
    wrapper: "field",
    as: "div",
    align: "center",
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
  /** Placeholder shown in Environment mode (e.g. LUNCHFLOW_API_KEY). */
  envPlaceholder?: string;
  get: (root: TRoot, context: SourceFormContext) => string;
  set: (root: TRoot, value: string, context: SourceFormContext) => TRoot;
}) {
  const { envPlaceholder, ...fieldConfig } = config;
  return customViewField<TRoot, SourceFormContext, string>({
    ...fieldConfig,
    component: SecretField as FormCustomRenderer<
      TRoot,
      SourceFormContext,
      string
    >,
    view: "edit",
    wrapper: "field",
    as: "div",
    align: "start",
    props: envPlaceholder ? { envPlaceholder } : undefined,
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
    merchantField({
      id: "merchantId",
      label: "Merchant",
      get: (source) => source.merchantId ?? "",
      set: (source, merchantId) => ({
        ...source,
        merchantId: optionalString(merchantId),
      }),
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
      id: "reviewDateFormat",
      label: "Review date format",
      placeholder: defaultReviewDateFormat,
      get: (source) => source.reviewDateFormat ?? defaultReviewDateFormat,
      set: (source, reviewDateFormat) => ({
        ...source,
        reviewDateFormat:
          optionalString(reviewDateFormat) === defaultReviewDateFormat
            ? undefined
            : optionalString(reviewDateFormat),
      }),
    }),
    textField({
      id: "reconciliationPriority",
      label: "Reconciliation priority",
      inputType: "number",
      placeholder: "0",
      get: (source) =>
        source.reconciliationPriority === undefined
          ? ""
          : String(source.reconciliationPriority),
      set: (source, value) => ({
        ...source,
        reconciliationPriority: optionalPriority(value),
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

/**
 * Connection-level details for multi-account providers (no top-level
 * sourceAccount).
 */
export const sourceDetailsGroupedForm = createFormConfig<
  EditableIngestionSource,
  SourceFormContext
>({
  id: "ingestion-source-details-grouped",
  fields: sourceDetailsForm.fields.filter(
    (field) => field.id !== "sourceAccount",
  ),
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
      get: (source) => source.api?.endpoint ?? "",
      set: (source, endpoint) => ({
        ...source,
        api: {
          ...(source.api ?? { secretRef: "" }),
          endpoint: optionalString(endpoint),
        },
      }),
    }),
    secretField({
      id: "api.secretRef",
      label: "API key",
      path: "api.secretRef",
      ariaLabel: "API key",
      envPlaceholder: "BANK_API_TOKEN",
      get: (source) => source.api?.secretRef ?? "",
      set: (source, secretRef) => ({
        ...source,
        api: { ...(source.api ?? { secretRef: "" }), secretRef },
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
      get: (source) => source.api?.authScheme ?? "bearer",
      set: (source, authScheme) => ({
        ...source,
        api: {
          ...(source.api ?? { secretRef: "" }),
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
      get: (source) => source.api?.recordsPath ?? "",
      set: (source, recordsPath) => ({
        ...source,
        api: {
          ...(source.api ?? { secretRef: "" }),
          recordsPath: optionalString(recordsPath),
        },
      }),
    }),
    textField({
      id: "api.allowedHosts",
      label: "Allowed hosts",
      path: "api.allowedHosts",
      placeholder: "api.example.com",
      get: (source) => joinList(source.api?.allowedHosts),
      set: (source, value) => ({
        ...source,
        api: {
          ...(source.api ?? { secretRef: "" }),
          allowedHosts: parseList(value),
        },
      }),
    }),
    switchField({
      id: "api.pagination",
      label: "Cursor pagination",
      ariaLabel: "Configure cursor pagination",
      get: (source) => Boolean(source.api?.pagination),
      set: (source, enabled) => ({
        ...source,
        api: {
          ...(source.api ?? { secretRef: "" }),
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
      get: (source) => source.api?.baseUrl ?? "",
      set: (source, baseUrl) => ({
        ...source,
        api: {
          ...(source.api ?? { secretRef: "" }),
          baseUrl: optionalString(baseUrl),
        },
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
      get: (source) => source.api?.pagination?.cursorQueryParam ?? "",
      set: (source, cursorQueryParam) => ({
        ...source,
        api: {
          ...(source.api ?? { secretRef: "" }),
          pagination: {
            cursorQueryParam,
            nextCursorPath: source.api?.pagination?.nextCursorPath ?? "",
          },
        },
      }),
    }),
    textField({
      id: "ingestion-pagination-next",
      label: "Next cursor path",
      get: (source) => source.api?.pagination?.nextCursorPath ?? "",
      set: (source, nextCursorPath) => ({
        ...source,
        api: {
          ...(source.api ?? { secretRef: "" }),
          pagination: {
            cursorQueryParam: source.api?.pagination?.cursorQueryParam ?? "",
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
        get: (source) => mappingFor(source)[field.key] ?? "",
        set: (source, value) => ({
          ...source,
          mapping: {
            ...mappingFor(source),
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
      get: (source) => mappingFor(source).amountSign ?? "as-is",
      set: (source, amountSign) => ({
        ...source,
        mapping: {
          ...mappingFor(source),
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
  ],
});
