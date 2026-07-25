<script lang="ts">
  import { type FormValidationIssue } from "@beancount-js/ui/forms";
  import type { JsonApiLinkedAccount } from "@beancount-js/beangulp";
  import { onDestroy } from "svelte";
  import { useContext } from "../context";
  import { useNavigation } from "../router/router";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import {
    availableIngestionSamples,
    ingestionSamples,
    type IngestionSample,
  } from "../ingestion/samples";
  import {
    isConnectorSource,
    isGroupedSource,
    sourceBaseUrl,
    sourceSecretRef,
  } from "../ingestion/connectors";
  import { clientConnector } from "../ingestion/connectors";
  import { connectorFieldsForm } from "../ingestion/connector-fields";
  import {
    renderSetupMarkdown,
    setupHost,
    setupHref,
  } from "../ingestion/setup-markdown";
  import {
    isSecretConfigured,
    secretDisplayValue,
    secretMode,
    secretStoredValue,
    type SecretMode,
  } from "../ingestion/secret-ref";
  import {
    duplicateIngestionSource,
    editableIngestionConfig,
    newIngestionSource,
    parseEditableIngestionYaml,
    serializeEditableIngestionYaml,
    sourceFromSample,
    sourceIdForNewSource,
    validateEditableIngestionConfig,
    type EditableIngestionConfig,
    type EditableIngestionSource,
  } from "../ingestion/source-form";
  import { latestIngestionSyncJob } from "../ingestion/sync";
  import { beginIngestionSync } from "../studio/sync-status";
  import type { IngestionConfigResponse } from "../ingestion/types";
  import { accountAppearanceStore } from "../lib/account-appearance";
  import { urlForAccount } from "../helpers";
  import {
    IngestionConfigEditor,
    sourceFormSectionIds,
  } from "@beancount-js/ui/forms";
  import {
    sourceApiForm,
    sourceApiGroupedForm,
    sourceDetailsForm,
    sourceDetailsGroupedForm,
    sourceEnrichmentDetailsForm,
    sourceEnrichmentForm,
    sourceMappingForm,
    sourcePaginationForm,
  } from "../ingestion/source-form-config";

  const { snapshot, activeFile } = useStudioWorkspace();
  const { router } = useNavigation();
  const { ledgerData } = useContext();
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";

  type EditorMode = "form" | "yaml";
  type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
  type ConnectionMerchant = {
    merchantId: string;
    canonicalName: string;
    logoUrl?: string;
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

  type IngestionSourcePreview = {
    key: string;
    name: string;
    accountCount: number;
    grouped: boolean;
    accounts: readonly IngestionSourcePreviewAccount[];
    status: {
      connected: boolean;
      lastSyncedAt?: string;
      syncing?: boolean;
      failed?: boolean;
    };
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

  let config = $state<EditableIngestionConfig | undefined>(undefined);
  let loadedConfig = $state<IngestionConfigResponse | undefined>(undefined);
  let yamlText = $state("");
  let yamlError = $state("");
  let status = $state("");
  let mode = $state<EditorMode>("form");
  let previewMode = $state(true);
  let loadedProjectId = $state("");
  let saving = $state(false);
  let syncAllBusy = $state(false);
  let saveState = $state<SaveState>("idle");
  let saveTimer: number | null = null;
  let syncJobsBySourceId = $state<
    Record<string, Awaited<ReturnType<typeof latestIngestionSyncJob>>>
  >({});
  let merchantsById = $state<Record<string, ConnectionMerchant>>({});
  const accountAppearances = accountAppearanceStore(ledgerData);
  /** Open section ids keyed by source index. Missing key = fully expanded. */
  let openBySourceIndex = $state<Record<number, string[]>>({});

  const availableIngestionSources = $derived.by(() =>
    availableIngestionSamples(config?.sources ?? [], ingestionSamples),
  );

  const validationIssues = $derived(
    config ? validateEditableIngestionConfig(config) : [],
  );
  const sectionsCollapsedAll = $derived(
    config
      ? config.sources.some((source, index) => {
          const expected = sourceFormSectionIds(isGroupedSource(source));
          const open = openBySourceIndex[index] ?? expected;
          return open.length !== expected.length;
        })
      : false,
  );
  const saveHint = $derived(
    saveState === "dirty"
      ? "Unsaved changes…"
      : saveState === "saving"
        ? "Saving…"
        : saveState === "saved"
          ? "Saved"
          : saveState === "error"
            ? "Save failed"
            : "",
  );
  const connectionStatuses = $derived.by(() => {
    const statuses: Record<
      string,
      {
        connected: boolean;
        lastSyncedAt?: string;
        syncing?: boolean;
        failed?: boolean;
      }
    > = {};
    for (const source of config?.sources ?? []) {
      const persisted = loadedConfig?.sources.find(
        (item) => item.id === source.id,
      );
      const job = syncJobsBySourceId[source.id];
      statuses[source.id] = {
        connected:
          persisted?.credentialAvailable ??
          isSecretConfigured(sourceSecretRef(source)),
        lastSyncedAt: job?.completedAt,
        syncing: job?.status === "queued" || job?.status === "running",
        failed: job?.status === "failed",
      };
    }
    return statuses;
  });
  const syncableSources = $derived(
    (config?.sources ?? []).filter(
      (source) => connectionStatuses[source.id]?.connected,
    ),
  );

  function sourceDefaultCurrency(source: EditableIngestionSource) {
    return (source as { defaultCurrency?: string }).defaultCurrency;
  }

  function sourceMerchantById(source: EditableIngestionSource) {
    return source.merchantId
      ? merchantsById[source.merchantId]
      : undefined;
  }

  function accountMerchantFor(sourceAccount: string) {
    const appearance = $accountAppearances.get(sourceAccount);
    const merchantId = appearance?.merchantId;
    return merchantId ? merchantsById[merchantId] : undefined;
  }

  const sourceMerchants = $derived.by(() =>
    Object.values(merchantsById).sort((left, right) =>
      left.canonicalName.localeCompare(right.canonicalName),
    ),
  );

  function sourceFormConfig(source: EditableIngestionSource) {
    const connector = isConnectorSource(source) ? clientConnector(source.kind) : undefined;
    const isGrouped = isGroupedSource(source);
    const sourceSections =
      connector?.connectionFields?.length
        ? connectorFieldsForm(
            connector.connectionFields,
            `${connector.kind}-connection`,
          )
        : undefined;
    const advancedSections =
      connector?.advancedFields?.length
        ? connectorFieldsForm(
            connector.advancedFields,
            `${connector.kind}-advanced`,
          )
        : undefined;

    return {
      detailsForm: isGrouped ? sourceDetailsGroupedForm : sourceDetailsForm,
      apiForm: isGrouped ? sourceApiGroupedForm : sourceApiForm,
      sourcePaginationForm,
      sourceMappingForm,
      sourceEnrichmentForm,
      sourceEnrichmentDetailsForm,
      connectionFieldsForm: sourceSections,
      advancedFieldsForm: advancedSections,
      providerCategories: connector?.providerCategories,
      isConnector: Boolean(connector),
      isGrouped,
    };
  }

  const sourceRows = $derived.by(() => {
    return (config?.sources ?? []).map((source, index) => {
      const serverSource = serverSourceFor(source);
      return {
        source,
        issues: issuesForSource(index),
        accounts: loadedConfig?.accounts ?? [],
        categoryAccounts:
          serverSource?.allowedAccounts ?? loadedConfig?.accounts ?? [],
        credentialAvailable: serverSource?.credentialAvailable,
        merchantCredentialAvailable: serverSource?.merchantCredentialAvailable,
        openSections: openSectionsFor(index, isGroupedSource(source)),
        sourceFormConfig: sourceFormConfig(source),
      };
    });
  });

  function withConfig(
    source: EditableIngestionSource,
    patch: Record<string, unknown>,
  ): EditableIngestionSource {
    return {
      ...source,
      config: {
        ...((source.config as Record<string, unknown> | undefined) ?? {}),
        ...patch,
      },
    };
  }

  function withApi(
    source: EditableIngestionSource,
    patch: Partial<{ endpoint: string; baseUrl: string; secretRef: string }>,
  ): EditableIngestionSource {
    return {
      ...source,
      api: { ...(source.api ?? { secretRef: "" }), ...patch },
    };
  }

  function sourceStatus(source: EditableIngestionSource) {
    return (
      connectionStatuses[source.id] ?? {
        connected: false,
      }
    );
  }

  const previewSources = $derived.by(() => {
    return (config?.sources ?? []).map((source, index): IngestionSourcePreview => {
      const merchant = sourceMerchantById(source);
      const grouped = isGroupedSource(source);
      const secretRef = sourceSecretRef(source);
      const previewUrl = sourceBaseUrl(source) || source.api?.endpoint || "";
      const sourceDefaultCurrencyValue = sourceDefaultCurrency(source);
      const accounts = (source.accounts ?? []).map(
        (account: JsonApiLinkedAccount) => {
          const accountMerchant = accountMerchantFor(account.sourceAccount);
          return {
            id: account.id,
            name: account.name,
            sourceAccount: account.sourceAccount,
            defaultCurrency:
              account.defaultCurrency ?? sourceDefaultCurrencyValue,
            color: $accountAppearances.get(account.sourceAccount)?.color,
            icon: $accountAppearances.get(account.sourceAccount)?.icon,
            merchantLogoUrl: accountMerchant?.logoUrl,
            href: urlForAccount(
              account.sourceAccount,
              undefined,
              $activeFile,
            ),
          } satisfies IngestionSourcePreviewAccount;
        },
      );

      return {
        key: source.id || `source-${index}`,
        name: source.name || "Untitled source",
        accountCount: accounts.length,
        grouped,
        accounts,
        status: sourceStatus(source),
        secretMode: secretMode(secretRef),
        secretDisplayValue: secretDisplayValue(secretRef),
        setupHost: setupHost(previewUrl),
        setupHref: setupHref(previewUrl),
        setupHtml: source.setup?.trim()
          ? renderSetupMarkdown(source.setup)
          : undefined,
        baseUrl: sourceBaseUrl(source),
        endpoint: source.api?.endpoint,
        merchantLogoUrl: merchant?.logoUrl,
        merchantId: merchant?.merchantId,
      } satisfies IngestionSourcePreview;
    });
  });

  async function load() {
    if (!$snapshot || isWeb) return;
    try {
      const response = await ingestionJson<IngestionConfigResponse>(
        ingestionPath($snapshot.project.id),
      );
      const draft = editableIngestionConfig(response);
      loadedConfig = response;
      config = draft;
      yamlText = serializeEditableIngestionYaml(draft);
      expandAllSections(draft.sources);
      loadedProjectId = $snapshot.project.id;
      yamlError = "";
      saveState = "idle";
      status = "";
      void loadSyncJobs($snapshot.project.id, draft.sources);
      void loadMerchants($snapshot.project.id);
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
      saveState = "error";
    }
  }

  async function loadMerchants(projectId: string) {
    try {
      const merchants = await ingestionJson<ConnectionMerchant[]>(
        ingestionPath(projectId, "/merchants"),
      );
      if ($snapshot?.project.id !== projectId) return;
      merchantsById = Object.fromEntries(
        merchants.map((merchant) => [merchant.merchantId, merchant]),
      );
    } catch {
      if ($snapshot?.project.id === projectId) merchantsById = {};
    }
  }

  function expandAllSections(sources: EditableIngestionSource[]) {
    const next: Record<number, string[]> = {};
    sources.forEach((source, index) => {
      next[index] = sourceFormSectionIds(isGroupedSource(source));
    });
    openBySourceIndex = next;
  }

  function collapseAllSections() {
    if (!config) return;
    const next: Record<number, string[]> = {};
    config.sources.forEach((_, index) => {
      next[index] = [];
    });
    openBySourceIndex = next;
  }

  function openSectionsFor(index: number, grouped = false) {
    return openBySourceIndex[index] ?? sourceFormSectionIds(grouped);
  }

  function setOpenSectionsFor(index: number, sections: string[]) {
    openBySourceIndex = { ...openBySourceIndex, [index]: sections };
  }

  function remapOpenSectionsAfterRemove(removedIndex: number) {
    const next: Record<number, string[]> = {};
    for (const [key, value] of Object.entries(openBySourceIndex)) {
      const index = Number(key);
      if (!Number.isInteger(index)) continue;
      if (index < removedIndex) next[index] = value;
      else if (index > removedIndex) next[index - 1] = value;
    }
    openBySourceIndex = next;
  }

  function updateSource(index: number, next: EditableIngestionSource) {
    if (!config) return;
    config = {
      ...config,
      sources: config.sources.map((source, sourceIndex) =>
        sourceIndex === index ? next : source,
      ),
    };
    scheduleSave();
  }

  function updatePreviewSecretMode(index: number, nextMode: SecretMode) {
    const source = config?.sources[index];
    if (!source) return;
    if (secretMode(sourceSecretRef(source)) === nextMode) return;
    updateSource(
      index,
      isConnectorSource(source)
        ? withConfig(source, { secretRef: secretStoredValue(nextMode, "") })
        : withApi(source, { secretRef: secretStoredValue(nextMode, "") }),
    );
  }

  function updatePreviewSecretValue(
    index: number,
    value: string,
    nextMode: SecretMode,
  ) {
    const source = config?.sources[index];
    if (!source) return;
    const nextSecretRef = secretStoredValue(
      nextMode,
      value,
    );
    updateSource(
      index,
      isConnectorSource(source)
        ? withConfig(source, { secretRef: nextSecretRef })
        : withApi(source, { secretRef: nextSecretRef }),
    );
  }

  function updatePreviewBaseUrl(index: number, nextBaseUrl: string) {
    const source = config?.sources[index];
    if (!source) return;
    updateSource(
      index,
      isConnectorSource(source)
        ? withConfig(source, { baseUrl: nextBaseUrl })
        : withApi(source, { baseUrl: nextBaseUrl }),
    );
  }

  function updatePreviewEndpoint(index: number, nextEndpoint: string) {
    const source = config?.sources[index];
    if (!source) return;
    updateSource(index, withApi(source, { endpoint: nextEndpoint }));
  }

  function updateReconciliation(
    field: "duplicateWindowDays" | "transferWindowDays" | "fxRateTolerance",
    value: string,
  ) {
    if (!config) return;
    const clean = value.trim();
    const parsed = clean ? Number(clean) : undefined;
    const reconciliation = { ...config.reconciliation, [field]: parsed };
    const compact = Object.fromEntries(
      Object.entries(reconciliation).filter(([, item]) => item !== undefined),
    );
    config = {
      ...config,
      reconciliation: Object.keys(compact).length ? compact : undefined,
    };
    scheduleSave();
  }

  function addSource() {
    if (!config) return;
    const source = newIngestionSource(config.sources);
    const index = config.sources.length;
    config = { ...config, sources: [...config.sources, source] };
    mode = "form";
    setOpenSectionsFor(index, sourceFormSectionIds(isGroupedSource(source)));
    scheduleSave();
  }

  function connectSampleDirect(sample: IngestionSample) {
    if (!config) return;
    const source = sourceFromSample(sample.template, config.sources);
    appendConnectedSource(source);
  }

  function appendConnectedSource(source: EditableIngestionSource) {
    if (!config) return;
    let next = source;
    const taken = new Set(config.sources.map((item) => item.id));
    if (!next.id || taken.has(next.id)) {
      next = { ...next, id: sourceIdForNewSource(config.sources) };
    }
    const index = config.sources.length;
    config = { ...config, sources: [...config.sources, next] };
    setOpenSectionsFor(index, sourceFormSectionIds(isGroupedSource(next)));
    scheduleSave();
  }

  function duplicateSource(index: number) {
    if (!config) return;
    const current = config.sources[index];
    if (!current) return;
    const source = duplicateIngestionSource(current, config.sources);
    const nextIndex = config.sources.length;
    config = { ...config, sources: [...config.sources, source] };
    mode = "form";
    setOpenSectionsFor(
      nextIndex,
      sourceFormSectionIds(isGroupedSource(source)),
    );
    scheduleSave();
  }

  function removeSource(index: number) {
    if (!config) return;
    const current = config.sources[index];
    if (!current) return;
    if (!confirm(`Remove ${current.name}?`)) return;
    config = {
      ...config,
      sources: config.sources.filter((_, sourceIndex) => sourceIndex !== index),
    };
    remapOpenSectionsAfterRemove(index);
    scheduleSave();
  }

  function setYamlMode(pressed: boolean) {
    if (pressed) {
      if (!config) return;
      yamlText = serializeEditableIngestionYaml(config);
      yamlError = "";
      mode = "yaml";
      return;
    }
    if (applyYaml()) mode = "form";
  }

  function togglePreviewMode() {
    previewMode = !previewMode;
    if (previewMode) mode = "form"; // leave yaml when entering preview
  }

  function applyYaml(options?: { schedule?: boolean }) {
    try {
      const next = parseEditableIngestionYaml(yamlText);
      config = next;
      expandAllSections(next.sources);
      yamlError = "";
      if (options?.schedule !== false) {
        status = "YAML applied. Changes save automatically.";
        scheduleSave();
      }
      return true;
    } catch (error) {
      yamlError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  function resetYaml() {
    if (!config) return;
    yamlText = serializeEditableIngestionYaml(config);
    yamlError = "";
  }

  function toggleAllSections() {
    if (!config) return;
    if (sectionsCollapsedAll) expandAllSections(config.sources);
    else collapseAllSections();
  }

  function firstInvalidSource(issues: FormValidationIssue[]) {
    const path = issues.find((issue) => issue.path)?.path;
    const match = path?.match(/^sources\.(\d+)\./);
    const index = match ? Number(match[1]) : Number.NaN;
    return Number.isInteger(index) ? index : undefined;
  }

  function issuesForSource(index: number) {
    return validationIssues.filter((issue) =>
      issue.path?.startsWith(`sources.${index}.`),
    );
  }

  function serverSourceFor(source: EditableIngestionSource) {
    return loadedConfig?.sources.find((item) => item.id === source.id);
  }

  function openReviewImports() {
    router.push("/records");
  }

  function openManageAccounts() {
    router.push("/import/accounts");
  }

  async function loadSyncJobs(
    projectId: string,
    sources: readonly { id: string }[],
  ) {
    const entries = await Promise.all(
      sources.map(async (source) => {
        try {
          return [
            source.id,
            await latestIngestionSyncJob(projectId, source.id),
          ] as const;
        } catch {
          return [source.id, null] as const;
        }
      }),
    );
    if (loadedProjectId === projectId) {
      syncJobsBySourceId = Object.fromEntries(entries);
    }
  }

  function setSyncJob(
    sourceId: string,
    job: NonNullable<Awaited<ReturnType<typeof latestIngestionSyncJob>>>,
  ) {
    syncJobsBySourceId = { ...syncJobsBySourceId, [sourceId]: job };
  }

  async function syncSource(source: EditableIngestionSource) {
    if (!$snapshot || !connectionStatuses[source.id]?.connected) return;
    const job = await beginIngestionSync({
      projectId: $snapshot.project.id,
      sourceId: source.id,
      sourceName: source.name || source.id,
      onUpdate: (next) => setSyncJob(source.id, next),
    });
    setSyncJob(source.id, job);
  }

  function syncSingle(source: EditableIngestionSource) {
    status = "";
    void syncSource(source).catch((error) => {
      status = error instanceof Error ? error.message : String(error);
    });
  }

  async function syncAll() {
    if (syncAllBusy || !syncableSources.length) return;
    syncAllBusy = true;
    status = "";
    try {
      for (const source of syncableSources) {
        await syncSource(source);
      }
      status = "All configured connections synced.";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      syncAllBusy = false;
    }
  }

  function scheduleSave() {
    if (isWeb || !$snapshot || !config) return;
    saveState = "dirty";
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      void saveNow();
    }, 1200);
  }

  async function saveNow() {
    if (!$snapshot || !config || isWeb) return;
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (mode === "yaml" && !applyYaml({ schedule: false })) return;
    const issues = validateEditableIngestionConfig(config);
    if (issues.length) {
      const invalidIndex = firstInvalidSource(issues);
      if (invalidIndex !== undefined) {
        const invalid = config.sources[invalidIndex];
        setOpenSectionsFor(
          invalidIndex,
          sourceFormSectionIds(invalid ? isGroupedSource(invalid) : false),
        );
      }
      mode = "form";
      status =
        "Resolve the highlighted source validation errors before saving.";
      saveState = "error";
      return;
    }

    saving = true;
    saveState = "saving";
    status = "Saving…";
    try {
      await ingestionJson(ingestionPath($snapshot.project.id), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      const response = await ingestionJson<IngestionConfigResponse>(
        ingestionPath($snapshot.project.id),
      );
      loadedConfig = response;
      void loadSyncJobs($snapshot.project.id, response.sources);
      status = "Saved.";
      saveState = "saved";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
      saveState = "error";
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    const project = $snapshot;
    if (project && !isWeb && loadedProjectId !== project.project.id) {
      void load();
    }
  });

  $effect(() => {
    if (isWeb) return;
    ingestionHeaderActions.set({
      kind: "editor",
      saveHint,
      configReady: Boolean(config),
      sectionsCollapsedAll,
      yamlMode: mode === "yaml",
      previewMode,
      canSyncAll: syncableSources.length > 0,
      syncAllBusy,
      onToggleCollapse: toggleAllSections,
      onYamlMode: setYamlMode,
      onTogglePreview: togglePreviewMode,
      onSyncAll: () => void syncAll(),
      onReviewImports: openReviewImports,
    });
  });

  onDestroy(() => {
    ingestionHeaderActions.set(null);
    if (saveTimer) window.clearTimeout(saveTimer);
    if (saveState === "dirty") void saveNow();
  });
</script>

<IngestionConfigEditor
  {isWeb}
  {config}
  {status}
  {yamlText}
  {yamlError}
  {previewMode}
  {saving}
  availableSamples={availableIngestionSources}
  {previewSources}
  envKeys={$snapshot?.envKeys ?? []}
  {sourceRows}
  snapshotProjectId={$snapshot?.project.id ?? ""}
  merchants={sourceMerchants}
  onYamlChange={(value) => {
    yamlText = value;
  }}
  onYamlApply={() => {
    void applyYaml();
  }}
  onYamlReset={resetYaml}
  onConnectSample={connectSampleDirect}
  onManageAccounts={openManageAccounts}
  onSync={(index) => {
    const source = config?.sources[index];
    if (source) syncSingle(source);
  }}
  onSecretModeChange={updatePreviewSecretMode}
  onSecretValueChange={updatePreviewSecretValue}
  onBaseUrlChange={updatePreviewBaseUrl}
  onEndpointChange={updatePreviewEndpoint}
  onSave={() => {
    void saveNow();
  }}
  onReconciliationChange={updateReconciliation}
  onSourceChange={updateSource}
  onSourceOpenSectionsChange={setOpenSectionsFor}
  onSourceDuplicate={duplicateSource}
  onSourceRemove={removeSource}
  onAddSource={addSource}
  onOpenBrandSettings={() => {
    router.push("/import/brands");
  }}
/>
