<script lang="ts">
  import {
    FormAddButton,
    YamlBackedForm,
    type FormValidationIssue,
  } from "@beancount-js/forms";
  import FileCode2 from "lucide-svelte/icons/file-code-2";
  import Plus from "lucide-svelte/icons/plus";
  import { onDestroy } from "svelte";
  import * as Alert from "$lib/components/ui/alert";
  import * as Empty from "$lib/components/ui/empty";
  import { useNavigation } from "../router/router";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import { ingestionSamples, type IngestionSample } from "../ingestion/samples";
  import { isGroupedJsonApiSource } from "@beancount-js/beangulp";
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
  import type { IngestionConfigResponse } from "../ingestion/types";
  import IngestionSourceForm, {
    sourceFormSectionIds,
  } from "./IngestionSourceForm.svelte";
  import IngestionSourcesPreview from "./IngestionSourcesPreview.svelte";

  const { snapshot, activeFile } = useStudioWorkspace();
  const { router } = useNavigation();
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";

  type EditorMode = "form" | "yaml";
  type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

  let config = $state<EditableIngestionConfig | undefined>(undefined);
  let loadedConfig = $state<IngestionConfigResponse | undefined>(undefined);
  let yamlText = $state("");
  let yamlError = $state("");
  let status = $state("");
  let mode = $state<EditorMode>("form");
  let previewMode = $state(true);
  let loadedProjectId = $state("");
  let saving = $state(false);
  let saveState = $state<SaveState>("idle");
  let saveTimer: number | null = null;
  /** Open section ids keyed by source index. Missing key = fully expanded. */
  let openBySourceIndex = $state<Record<number, string[]>>({});

  const validationIssues = $derived(
    config ? validateEditableIngestionConfig(config) : [],
  );
  const sectionsCollapsedAll = $derived(
    config
      ? config.sources.some((source, index) => {
          const expected = sourceFormSectionIds(
            source.rules?.length ?? 0,
            isGroupedJsonApiSource(source),
          );
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
      status =
        "API keys can be stored inline, or as env:NAME from the process environment or project .env (pick a key in Environment mode).";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
      saveState = "error";
    }
  }

  function expandAllSections(sources: EditableIngestionSource[]) {
    const next: Record<number, string[]> = {};
    sources.forEach((source, index) => {
      next[index] = sourceFormSectionIds(
        source.rules?.length ?? 0,
        isGroupedJsonApiSource(source),
      );
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

  function openSectionsFor(index: number, ruleCount: number, grouped = false) {
    return openBySourceIndex[index] ?? sourceFormSectionIds(ruleCount, grouped);
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

  function addSource() {
    if (!config) return;
    const source = newIngestionSource(config.sources);
    const index = config.sources.length;
    config = { ...config, sources: [...config.sources, source] };
    mode = "form";
    setOpenSectionsFor(
      index,
      sourceFormSectionIds(
        source.rules?.length ?? 0,
        isGroupedJsonApiSource(source),
      ),
    );
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
    setOpenSectionsFor(
      index,
      sourceFormSectionIds(
        next.rules?.length ?? 0,
        isGroupedJsonApiSource(next),
      ),
    );
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
      sourceFormSectionIds(
        source.rules?.length ?? 0,
        isGroupedJsonApiSource(source),
      ),
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
          sourceFormSectionIds(
            invalid?.rules?.length ?? 0,
            invalid ? isGroupedJsonApiSource(invalid) : false,
          ),
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
      // Concurrent scheduleSave during the await leaves dirty + a pending timer.
      if (saveState !== "dirty") {
        status = "Saved.";
        saveState = "saved";
      }
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
      onToggleCollapse: toggleAllSections,
      onYamlMode: setYamlMode,
      onTogglePreview: togglePreviewMode,
      onReviewImports: openReviewImports,
    });
  });

  onDestroy(() => {
    ingestionHeaderActions.set(null);
    if (saveTimer) window.clearTimeout(saveTimer);
    if (saveState === "dirty") void saveNow();
  });
</script>

<section
  class={previewMode
    ? "h-full overflow-y-auto p-4 sm:p-6"
    : "h-full overflow-y-auto p-6 sm:p-8 lg:p-10"}
  data-ingestion-sources-editor
>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
    {#if isWeb}
      <Alert.Root>
        <FileCode2 />
        <Alert.Title>Local server required</Alert.Title>
        <Alert.Description
          >Remote ingestion settings are available only through the local
          server.</Alert.Description
        >
      </Alert.Root>
    {:else if !config}
      <Empty.Root class="min-h-64 border">
        <Empty.Header>
          <Empty.Media variant="icon"><FileCode2 /></Empty.Media>
          <Empty.Title>Loading sources</Empty.Title>
          <Empty.Description
            >Reading the local project ingestion configuration.</Empty.Description
          >
        </Empty.Header>
      </Empty.Root>
    {:else}
      <div class="flex min-w-0 flex-col gap-6">
        <YamlBackedForm
          yamlMode={mode === "yaml"}
          {yamlText}
          {yamlError}
          yamlLabel="Ingestion sources YAML editor"
          yamlApplyLabel="Apply YAML"
          onYamlChange={(value) => {
            yamlText = value;
          }}
          onYamlApply={() => {
            void applyYaml();
          }}
          onYamlReset={resetYaml}
        >
          <div class="flex min-w-0 flex-col gap-8">
            {#if previewMode}
              <IngestionSourcesPreview
                sources={config.sources}
                samples={ingestionSamples}
                envKeys={$snapshot?.envKeys ?? []}
                {saving}
                onChange={(index, next) => updateSource(index, next)}
                onConnectSample={connectSampleDirect}
                onManageAccounts={openManageAccounts}
                onSave={() => void saveNow()}
              />
            {:else}
              {#each config.sources as source, index (source.id || index)}
                {@const serverSource = serverSourceFor(source)}
                <IngestionSourceForm
                  {source}
                  accounts={loadedConfig?.accounts ?? []}
                  issues={issuesForSource(index)}
                  credentialAvailable={serverSource?.credentialAvailable}
                  merchantCredentialAvailable={serverSource?.merchantCredentialAvailable}
                  envKeys={$snapshot?.envKeys ?? []}
                  openSections={openSectionsFor(
                    index,
                    source.rules?.length ?? 0,
                    isGroupedJsonApiSource(source),
                  )}
                  onOpenSectionsChange={(sections) =>
                    setOpenSectionsFor(index, sections)}
                  onChange={(next) => updateSource(index, next)}
                  onDuplicate={() => duplicateSource(index)}
                  onRemove={() => removeSource(index)}
                />
              {:else}
                <Empty.Root class="min-h-48 border">
                  <Empty.Header>
                    <Empty.Media variant="icon">
                      <button
                        type="button"
                        class="inline-flex size-full items-center justify-center"
                        aria-label="Add source"
                        onclick={addSource}
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

              {#if config.sources.length}
                <div class="flex justify-end">
                  <FormAddButton label="Add source" onclick={addSource} />
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
