<script lang="ts">
  import {
    YamlBackedForm,
    type FormValidationIssue,
  } from "@beancount-js/forms";
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import Copy from "lucide-svelte/icons/copy";
  import FileCode2 from "lucide-svelte/icons/file-code-2";
  import Plus from "lucide-svelte/icons/plus";
  import Trash2 from "lucide-svelte/icons/trash-2";
  import { Button } from "$lib/components/ui/button";
  import * as Alert from "$lib/components/ui/alert";
  import * as Empty from "$lib/components/ui/empty";
  import { Switch } from "$lib/components/ui/switch";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import {
    duplicateIngestionSource,
    editableIngestionConfig,
    exampleIngestionConfig,
    newIngestionSource,
    parseEditableIngestionYaml,
    serializeEditableIngestionYaml,
    validateEditableIngestionConfig,
    type EditableIngestionConfig,
    type EditableIngestionSource,
  } from "../ingestion/source-form";
  import type { IngestionConfigResponse } from "../ingestion/types";
  import IngestionSourceForm, {
    sourceFormSections,
  } from "./IngestionSourceForm.svelte";

  const { snapshot } = useStudioWorkspace();
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";

  type EditorMode = "form" | "yaml";

  let config: EditableIngestionConfig | undefined;
  let loadedConfig: IngestionConfigResponse | undefined;
  let yamlText = "";
  let yamlError = "";
  let status = "";
  let selectedSourceIndex = -1;
  let mode: EditorMode = "form";
  let loadedProjectId = "";
  let saving = false;
  let openSourceSections: string[] = [...sourceFormSections];

  $: selectedSource =
    selectedSourceIndex >= 0 ? config?.sources[selectedSourceIndex] : undefined;
  $: selectedServerSource = loadedConfig?.sources.find(
    (source) => source.id === selectedSource?.id,
  );
  $: validationIssues = config ? validateEditableIngestionConfig(config) : [];
  $: selectedIssues = validationIssues.filter((issue) =>
    issue.path?.startsWith(`sources.${selectedSourceIndex}.`),
  );

  async function load() {
    if (!$snapshot || isWeb) return;
    try {
      const priorSourceId = config?.sources[selectedSourceIndex]?.id;
      const response = await ingestionJson<IngestionConfigResponse>(
        ingestionPath($snapshot.project.id),
      );
      const draft = editableIngestionConfig(response);
      loadedConfig = response;
      config = draft;
      yamlText = serializeEditableIngestionYaml(draft);
      selectedSourceIndex = draft.sources.findIndex(
        (source) => source.id === priorSourceId,
      );
      if (selectedSourceIndex < 0)
        selectedSourceIndex = draft.sources.length ? 0 : -1;
      loadedProjectId = $snapshot.project.id;
      yamlError = "";
      status =
        "Credentials use environment references such as env:BANK_API_TOKEN; token values are never saved here.";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    }
  }

  function selectSource(index: number) {
    selectedSourceIndex = index;
    mode = "form";
    yamlError = "";
    openSourceSections = [...sourceFormSections];
  }

  function updateSelectedSource(next: EditableIngestionSource) {
    if (!config || selectedSourceIndex < 0) return;
    config = {
      ...config,
      sources: config.sources.map((source, index) =>
        index === selectedSourceIndex ? next : source,
      ),
    };
  }

  function addSource() {
    if (!config) return;
    const source = newIngestionSource(config.sources);
    config = { ...config, sources: [...config.sources, source] };
    selectedSourceIndex = config.sources.length - 1;
    mode = "form";
    openSourceSections = [...sourceFormSections];
  }

  function duplicateSource() {
    if (!config || !selectedSource) return;
    const source = duplicateIngestionSource(selectedSource, config.sources);
    config = { ...config, sources: [...config.sources, source] };
    selectedSourceIndex = config.sources.length - 1;
    mode = "form";
    openSourceSections = [...sourceFormSections];
  }

  function removeSource() {
    if (!config || selectedSourceIndex < 0 || !selectedSource) return;
    if (
      !confirm(
        `Remove ${selectedSource.name}? This only changes the local draft until you save.`,
      )
    )
      return;
    const sources = config.sources.filter(
      (_, index) => index !== selectedSourceIndex,
    );
    config = { ...config, sources };
    selectedSourceIndex = Math.min(selectedSourceIndex, sources.length - 1);
  }

  function useExample() {
    config = structuredClone(exampleIngestionConfig);
    selectedSourceIndex = config.sources.length ? 0 : -1;
    yamlText = serializeEditableIngestionYaml(config);
    yamlError = "";
    mode = "form";
    openSourceSections = [...sourceFormSections];
    status =
      "Example source added to the local draft. Save sources to persist it.";
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

  function applyYaml() {
    try {
      const priorSourceId = selectedSource?.id;
      const next = parseEditableIngestionYaml(yamlText);
      config = next;
      selectedSourceIndex = next.sources.findIndex(
        (source) => source.id === priorSourceId,
      );
      if (selectedSourceIndex < 0)
        selectedSourceIndex = next.sources.length ? 0 : -1;
      yamlError = "";
      status = "YAML changes applied to the local source draft.";
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
    openSourceSections =
      openSourceSections.length === sourceFormSections.length
        ? []
        : [...sourceFormSections];
  }

  function firstInvalidSource(issues: FormValidationIssue[]) {
    const path = issues.find((issue) => issue.path)?.path;
    const match = path?.match(/^sources\.(\d+)\./);
    const index = match ? Number(match[1]) : Number.NaN;
    return Number.isInteger(index) ? index : undefined;
  }

  async function save() {
    if (!$snapshot || !config) return;
    if (mode === "yaml" && !applyYaml()) return;
    const issues = validateEditableIngestionConfig(config);
    if (issues.length) {
      selectedSourceIndex = firstInvalidSource(issues) ?? selectedSourceIndex;
      mode = "form";
      status =
        "Resolve the highlighted source validation errors before saving.";
      return;
    }

    saving = true;
    try {
      await ingestionJson(ingestionPath($snapshot.project.id), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      status = "Ingestion sources saved.";
      await load();
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      saving = false;
    }
  }

  $: if ($snapshot && !isWeb && loadedProjectId !== $snapshot.project.id) {
    void load();
  }
</script>

<section
  class="h-full overflow-y-auto p-3 sm:p-5"
  data-ingestion-sources-editor
>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
    <header
      class="flex flex-wrap items-start justify-between gap-4 border-b pb-5"
    >
      <h1 class="text-xl font-semibold">Sources</h1>
      {#if !isWeb}
        <div class="flex flex-wrap items-center justify-end gap-2">
          <div class="flex items-center gap-2">
            <Switch
              id="ingestion-yaml-mode"
              checked={mode === "yaml"}
              aria-label="YAML mode"
              onCheckedChange={setYamlMode}
            />
            <label for="ingestion-yaml-mode" class="text-sm font-semibold"
              >YAML</label
            >
          </div>
          <Button
            size="sm"
            variant="outline"
            data-testid="ingestion-use-example"
            onclick={useExample}>Use example</Button
          >
          <Button
            size="sm"
            disabled={saving || !config}
            onclick={() => void save()}>Save sources</Button
          >
          <Button size="sm" variant="outline" href="#/records"
            >Review imports</Button
          >
        </div>
      {/if}
    </header>

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
        <div class="flex min-w-0 flex-col gap-6">
          <section class="border-b pb-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="text-sm font-semibold">Sources</h2>
              <div class="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  aria-label="Add source"
                  onclick={addSource}
                  ><Plus data-icon="inline-start" />Add source</Button
                >
                <Button size="sm" variant="outline" onclick={useExample}>
                  Use example
                </Button>
              </div>
            </div>
            <div
              class="mt-3 flex flex-wrap gap-2"
              aria-label="Configured sources"
            >
              {#each config.sources as source, index (source.id || index)}
                <Button
                  variant={index === selectedSourceIndex
                    ? "secondary"
                    : "outline"}
                  size="sm"
                  class="h-auto max-w-full justify-start py-1.5 text-left"
                  onclick={() => selectSource(index)}
                >
                  <span class="min-w-0">
                    <span class="block truncate"
                      >{source.name || "Untitled source"}</span
                    >
                    <span
                      class="block truncate font-mono text-[11px] text-muted-foreground"
                    >
                      {source.id || "missing-id"}
                    </span>
                  </span>
                </Button>
              {:else}
                <p class="py-2 text-sm text-muted-foreground">
                  Add a source to begin.
                </p>
              {/each}
            </div>
          </section>

          {#if selectedSource}
            <section class="min-w-0">
              <div
                class="mb-4 flex flex-wrap items-start justify-between gap-3 border-b pb-4"
              >
                <div class="min-w-0">
                  <h2 class="truncate text-lg font-semibold">
                    {selectedSource.name || "Untitled source"}
                  </h2>
                  <p class="truncate font-mono text-xs text-muted-foreground">
                    {selectedSource.id || "missing-id"}
                  </p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={openSourceSections.length ===
                    sourceFormSections.length
                      ? "Collapse all source sections"
                      : "Expand all source sections"}
                    onclick={toggleAllSections}
                  >
                    {#if openSourceSections.length === sourceFormSections.length}
                      <ChevronsDownUp />
                    {:else}
                      <ChevronsUpDown />
                    {/if}
                  </Button>
                  <Button size="sm" variant="outline" onclick={duplicateSource}>
                    <Copy data-icon="inline-start" />Duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onclick={removeSource}
                  >
                    <Trash2 data-icon="inline-start" />Remove
                  </Button>
                </div>
              </div>
              <IngestionSourceForm
                source={selectedSource}
                accounts={loadedConfig?.accounts ?? []}
                issues={selectedIssues}
                credentialAvailable={selectedServerSource?.credentialAvailable}
                merchantCredentialAvailable={selectedServerSource?.merchantCredentialAvailable}
                openSections={openSourceSections}
                onOpenSectionsChange={(sections) =>
                  (openSourceSections = sections)}
                onChange={updateSelectedSource}
              />
            </section>
          {:else}
            <Empty.Root class="min-h-64 border">
              <Empty.Header>
                <Empty.Media variant="icon"><Plus /></Empty.Media>
                <Empty.Title>No source selected</Empty.Title>
                <Empty.Description
                  >Add a source or load the example configuration.</Empty.Description
                >
              </Empty.Header>
            </Empty.Root>
          {/if}
        </div>
      </YamlBackedForm>
    {/if}

    {#if status}
      <p class="text-sm text-muted-foreground" role="status">{status}</p>
    {/if}
  </div>
</section>
