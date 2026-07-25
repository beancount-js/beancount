<script lang="ts">
  import Plus from "lucide-svelte/icons/plus";
  import type { JsonApiLinkedAccount } from "@beancount-js/beangulp";
  import FormAddButton from "./FormAddButton.svelte";
  import FormField from "./FormField.svelte";
  import FormSectionHeader from "./FormSectionHeader.svelte";
  import YamlBackedForm from "./YamlBackedForm.svelte";
  import type { FormConfig, FormValidationIssue } from "./types";
  import * as Alert from "../shadcn/alert";
  import * as Empty from "../shadcn/empty";
  import { Input } from "../shadcn/input";
  import IngestionSourcesPreview from "./IngestionSourcesPreview.svelte";
  import IngestionSourceForm from "./IngestionSourceForm.svelte";
  import { type MerchantPickerMerchant } from "./MerchantPicker.svelte";

  type EditableIngestionSource = {
    id: string;
    name?: string;
    kind: string;
    config?: Record<string, unknown>;
    api?: {
      query?: Record<string, string>;
      pagination?: unknown;
      endpoint?: string;
      [key: string]: unknown;
    };
    accounts?: readonly JsonApiLinkedAccount[];
    [key: string]: unknown;
  };

  type EditableIngestionConfig = {
    sources: readonly EditableIngestionSource[];
    reconciliation?: {
      duplicateWindowDays?: number;
      transferWindowDays?: number;
      fxRateTolerance?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };

  type IngestionSourcePreviewAccount = {
    id: string;
    name: string;
    sourceAccount: string;
    defaultCurrency?: string;
    color?: string;
    icon?: string;
    merchantLogoUrl?: string;
    href: string;
  };

  type SecretMode = "env" | "inline";

  type IngestionConnectionStatus = {
    connected: boolean;
    lastSyncedAt?: string;
    syncing?: boolean;
    failed?: boolean;
  };

  type IngestionSample = {
    id: string;
    name: string;
    initials: string;
    accentClass: string;
    region: string;
    category: string;
    description: string;
    badge?: string;
    provider?: {
      id: string;
      baseUrl: string;
      accountsPath?: string;
    };
  };

  type IngestionSourcePreview = {
    key: string;
    name: string;
    accountCount: number;
    grouped: boolean;
    accounts: readonly IngestionSourcePreviewAccount[];
    status: IngestionConnectionStatus;
    secretMode: SecretMode;
    secretDisplayValue: string;
    setupHost: string;
    setupHref?: string;
    setupHtml?: string;
    baseUrl?: string;
    endpoint?: string;
    merchantLogoUrl?: string;
    merchantId?: string;
  };

  type SourceCategory = {
    code: string;
    label: string;
  };

  type SourceFormContext = {
    accounts: readonly string[];
    projectId?: string;
    merchants?: readonly MerchantPickerMerchant[];
    envKeys?: readonly string[];
    credentialAvailable?: boolean;
    merchantCredentialAvailable?: boolean;
    [key: string]: unknown;
  };

  type SourceFormConfig = {
    detailsForm: FormConfig<EditableIngestionSource, SourceFormContext>;
    apiForm: FormConfig<EditableIngestionSource, SourceFormContext>;
    sourcePaginationForm: FormConfig<EditableIngestionSource, SourceFormContext>;
    sourceMappingForm: FormConfig<EditableIngestionSource, SourceFormContext>;
    sourceEnrichmentForm: FormConfig<EditableIngestionSource, SourceFormContext>;
    sourceEnrichmentDetailsForm: FormConfig<
      EditableIngestionSource,
      SourceFormContext
    >;
    connectionFieldsForm?: FormConfig<
      EditableIngestionSource,
      SourceFormContext
    >;
    advancedFieldsForm?: FormConfig<
      EditableIngestionSource,
      SourceFormContext
    >;
    providerCategories?: readonly SourceCategory[];
    isConnector?: boolean;
    isGrouped?: boolean;
  };

  type SourceEditorRow = {
    source: EditableIngestionSource;
    issues: readonly FormValidationIssue[];
    accounts: readonly string[];
    categoryAccounts: readonly string[];
    credentialAvailable?: boolean;
    merchantCredentialAvailable?: boolean;
    openSections: readonly string[];
    sourceFormConfig: SourceFormConfig;
  };

  type ReconciliationField =
    | "duplicateWindowDays"
    | "transferWindowDays"
    | "fxRateTolerance";

  let {
    isWeb = false,
    config,
    status = "",
    yamlText = "",
    yamlError = "",
    previewMode = true,
    saving = false,
    availableSamples = [],
    previewSources = [],
    envKeys = [],
    sourceRows = [],
    snapshotProjectId = "",
    merchants = [],
    onYamlChange = () => {},
    onYamlApply = () => {},
    onYamlReset = () => {},
    onConnectSample = () => {},
    onManageAccounts = () => {},
    onSync = () => {},
    onSecretModeChange = () => {},
    onSecretValueChange = () => {},
    onBaseUrlChange = () => {},
    onEndpointChange = () => {},
    onSave = () => {},
    onReconciliationChange = () => {},
    onSourceChange = () => {},
    onSourceOpenSectionsChange = () => {},
    onSourceDuplicate = () => {},
    onSourceRemove = () => {},
    onAddSource = () => {},
    onOpenBrandSettings = () => {},
  }: {
    isWeb?: boolean;
    config?: EditableIngestionConfig;
    status?: string;
    yamlText?: string;
    yamlError?: string;
    previewMode?: boolean;
    saving?: boolean;
    availableSamples?: readonly IngestionSample[];
    previewSources?: readonly IngestionSourcePreview[];
    envKeys?: readonly string[];
    sourceRows?: readonly SourceEditorRow[];
    snapshotProjectId?: string;
    merchants?: readonly MerchantPickerMerchant[];
    onYamlChange?: (value: string) => void | Promise<void>;
    onYamlApply?: () => void | Promise<void>;
    onYamlReset?: () => void | Promise<void>;
    onConnectSample?: (sample: IngestionSample) => void | Promise<void>;
    onManageAccounts?: (index: number) => void | Promise<void>;
    onSync?: (index: number) => void | Promise<void>;
    onSecretModeChange?: (index: number, nextMode: SecretMode) => void;
    onSecretValueChange?: (
      index: number,
      nextValue: string,
      nextMode: SecretMode,
    ) => void;
    onBaseUrlChange?: (index: number, baseUrl: string) => void;
    onEndpointChange?: (index: number, endpoint: string) => void;
    onSave?: () => void | Promise<void>;
    onReconciliationChange?: (
      field: ReconciliationField,
      value: string,
    ) => void;
    onSourceChange?: (
      index: number,
      next: EditableIngestionSource,
    ) => void | Promise<void>;
    onSourceOpenSectionsChange?: (index: number, sections: string[]) => void;
    onSourceDuplicate?: (index: number) => void;
    onSourceRemove?: (index: number) => void;
    onAddSource?: () => void;
    onOpenBrandSettings?: () => void;
  } = $props();

  const reconciliation = $derived(config?.reconciliation);
</script>

<section
  class={previewMode
    ? "h-full overflow-y-auto p-4 sm:p-6"
    : "h-full overflow-y-auto p-6 sm:p-8 lg:p-10"}
  data-ingestion-sources-editor
>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-5">
    {#if isWeb}
      <Alert.Root>
        <Alert.Title>Local server required</Alert.Title>
        <Alert.Description
          >Remote ingestion settings are available only through the local
          server.</Alert.Description
        >
      </Alert.Root>
    {:else if !config}
      <Empty.Root class="min-h-48 border">
        <Empty.Header>
          <Empty.Media variant="icon" />
          <Empty.Title>Loading ingestion sources</Empty.Title>
          <Empty.Description>Fetching ingestion configuration.</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else}
      <div class="flex min-w-0 flex-col gap-6">
        <YamlBackedForm
          yamlMode={false}
          {yamlText}
          {yamlError}
          yamlLabel="Ingestion sources YAML editor"
          yamlApplyLabel="Apply YAML"
          onYamlChange={onYamlChange}
          onYamlApply={onYamlApply}
          onYamlReset={onYamlReset}
        >
          <div class="flex min-w-0 flex-col gap-8">
            {#if previewMode}
              <IngestionSourcesPreview
                sources={previewSources}
                samples={availableSamples}
                {envKeys}
                {saving}
                onConnectSample={onConnectSample}
                onManageAccounts={onManageAccounts}
                onSync={onSync}
                onSecretModeChange={onSecretModeChange}
                onSecretValueChange={onSecretValueChange}
                onBaseUrlChange={onBaseUrlChange}
                onEndpointChange={onEndpointChange}
                onSave={onSave}
              />
            {:else}
              <section>
                <FormSectionHeader
                  title="Reconciliation"
                  editable={false}
                  movable={false}
                  removable={false}
                />
                <div class="mt-3 grid gap-3 pl-6">
                  <div class="beancount-structured-form">
                    <FormField
                      label="Duplicate window (days)"
                      controlId="reconciliation-duplicate-window"
                      as="div"
                      align="center"
                    >
                      <Input
                        id="reconciliation-duplicate-window"
                        type="number"
                        min="0"
                        max="31"
                        step="1"
                        value={reconciliation?.duplicateWindowDays === undefined
                          ? ""
                          : String(reconciliation.duplicateWindowDays)}
                        placeholder="5"
                        oninput={(event) =>
                          onReconciliationChange(
                            "duplicateWindowDays",
                            event.currentTarget.value,
                          )}
                      />
                    </FormField>
                    <FormField
                      label="Transfer window (days)"
                      controlId="reconciliation-transfer-window"
                      as="div"
                      align="center"
                    >
                      <Input
                        id="reconciliation-transfer-window"
                        type="number"
                        min="0"
                        max="31"
                        step="1"
                        value={reconciliation?.transferWindowDays === undefined
                          ? ""
                          : String(reconciliation.transferWindowDays)}
                        placeholder="4"
                        oninput={(event) =>
                          onReconciliationChange(
                            "transferWindowDays",
                            event.currentTarget.value,
                          )}
                      />
                    </FormField>
                    <FormField
                      label="FX rate tolerance"
                      controlId="reconciliation-fx-rate-tolerance"
                      as="div"
                      align="center"
                    >
                      <Input
                        id="reconciliation-fx-rate-tolerance"
                        type="number"
                        min="0"
                        max="1"
                        step="0.001"
                        value={reconciliation?.fxRateTolerance === undefined
                          ? ""
                          : String(reconciliation.fxRateTolerance)}
                        placeholder="0.02"
                        oninput={(event) =>
                          onReconciliationChange(
                            "fxRateTolerance",
                            event.currentTarget.value,
                          )}
                      />
                    </FormField>
                  </div>
                </div>
              </section>

              {#each sourceRows as sourceRow, index (sourceRow.source.id || index)}
                <IngestionSourceForm
                  source={sourceRow.source}
                  detailsForm={sourceRow.sourceFormConfig.detailsForm}
                  apiForm={sourceRow.sourceFormConfig.apiForm}
                  sourcePaginationForm={
                    sourceRow.sourceFormConfig.sourcePaginationForm
                  }
                  sourceMappingForm={sourceRow.sourceFormConfig.sourceMappingForm}
                  sourceEnrichmentForm={
                    sourceRow.sourceFormConfig.sourceEnrichmentForm
                  }
                  sourceEnrichmentDetailsForm={
                    sourceRow.sourceFormConfig.sourceEnrichmentDetailsForm
                  }
                  connectionFieldsForm={
                    sourceRow.sourceFormConfig.connectionFieldsForm
                  }
                  advancedFieldsForm={
                    sourceRow.sourceFormConfig.advancedFieldsForm
                  }
                  providerCategories={
                    sourceRow.sourceFormConfig.providerCategories ?? []
                  }
                  isConnector={sourceRow.sourceFormConfig.isConnector}
                  isGrouped={sourceRow.sourceFormConfig.isGrouped}
                  accounts={sourceRow.accounts}
                  categoryAccounts={sourceRow.categoryAccounts}
                  issues={sourceRow.issues}
                  credentialAvailable={sourceRow.credentialAvailable}
                  merchantCredentialAvailable={
                    sourceRow.merchantCredentialAvailable
                  }
                  {envKeys}
                  projectId={snapshotProjectId}
                  merchants={merchants}
                  openSections={sourceRow.openSections}
                  onOpenSectionsChange={(sections) =>
                    onSourceOpenSectionsChange(index, sections)}
                  onChange={(next) => onSourceChange(index, next)}
                  onDuplicate={() => onSourceDuplicate(index)}
                  onRemove={() => onSourceRemove(index)}
                  onOpenBrandSettings={onOpenBrandSettings}
                />
              {:else}
                <Empty.Root class="min-h-48 border">
                  <Empty.Header>
                    <Empty.Media variant="icon">
                      <button
                        type="button"
                        class="inline-flex size-full items-center justify-center"
                        aria-label="Add source"
                        onclick={onAddSource}
                      >
                        <Plus />
                      </button>
                    </Empty.Media>
                    <Empty.Title>No sources yet</Empty.Title>
                    <Empty.Description
                      >Add a source to get started.</Empty.Description
                    >
                  </Empty.Header>
                </Empty.Root>
              {/each}

              {#if sourceRows.length}
                <div class="flex justify-end">
                  <FormAddButton label="Add source" onclick={onAddSource} />
                </div>
              {/if}
            {/if}
          </div>
        </YamlBackedForm>
      </div>
    {/if}

    {#if status}
      <p class="text-sm text-muted-foreground" role="status">{status}</p>
    {/if}
  </div>
</section>
