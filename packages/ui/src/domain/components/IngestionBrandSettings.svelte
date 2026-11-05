<script lang="ts">
  import { ArrowRight } from "@lucide/svelte";
  import { FileCode2 } from "@lucide/svelte";
  import { onDestroy } from "svelte";
  import {
    StructuredForm,
    type FormValidationIssue,
  } from "@lapismd/design-core/forms";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { useNavigation } from "../router/router";
  import { useStudioWorkspace } from "../studio/workspace";
  import { useIngestionApi, ingestionPath } from "../ingestion/api";
  const { ingestionJson } = useIngestionApi();
  import {
    brandSettingsForm,
    brandSettingsToggleForm,
  } from "../ingestion/brand-form-config";
  import {
    editableIngestionConfig,
    validateEditableIngestionConfig,
    type EditableIngestionConfig,
  } from "../ingestion/source-form";
  import type { SourceFormContext } from "../ingestion/source-form-config";
  import type { IngestionConfigResponse } from "../ingestion/types";
  import BrandSettingsSkeleton from "./skeletons/BrandSettingsSkeleton.svelte";

  const { snapshot } = useStudioWorkspace();
  const { router } = useNavigation();
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";

  type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

  let config = $state<EditableIngestionConfig | undefined>(undefined);
  let loadedConfig = $state<IngestionConfigResponse | undefined>(undefined);
  let loadedProjectId = $state("");
  let status = $state("");
  let saving = $state(false);
  let saveState = $state<SaveState>("idle");
  let saveTimer: number | null = null;

  const formContext = $derived({
    accounts: loadedConfig?.accounts ?? [],
    envKeys: $snapshot?.envKeys ?? [],
  } satisfies SourceFormContext);
  const brandIssues = $derived(
    config
      ? validateEditableIngestionConfig(config).filter((issue) =>
          issue.path?.startsWith("brandfetch"),
        )
      : [],
  );
  const issues = $derived(augmentCredentialIssues(brandIssues));

  function augmentCredentialIssues(base: FormValidationIssue[]) {
    const next = [...base];
    if (
      config?.brandfetch?.enabled &&
      loadedConfig?.brandCredentialAvailable === false
    ) {
      next.push({
        fieldId: "brandfetch.clientId",
        message:
          "Brandfetch Logo API client ID is not available in this environment",
        severity: "warning",
      });
    }
    return next;
  }

  async function load() {
    if (!$snapshot || isWeb) return;
    try {
      const response = await ingestionJson<IngestionConfigResponse>(
        ingestionPath($snapshot.project.id, ""),
      );
      loadedConfig = response;
      config = editableIngestionConfig(response);
      loadedProjectId = $snapshot.project.id;
      saveState = "idle";
      status = "";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
      saveState = "error";
    }
  }

  function updateConfig(next: EditableIngestionConfig) {
    config = next;
    scheduleSave();
  }

  function openSources() {
    router.push("/import/editor");
  }

  function scheduleSave() {
    if (isWeb || !$snapshot || !config) return;
    saveState = "dirty";
    status = "Unsaved changes…";
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
    const allIssues = validateEditableIngestionConfig(config);
    if (allIssues.length) {
      const hasBrandIssues = allIssues.some((issue) =>
        issue.path?.startsWith("brandfetch"),
      );
      status = hasBrandIssues
        ? "Resolve the highlighted brand logo validation errors before saving."
        : "Resolve source validation errors under Sources before saving.";
      saveState = "error";
      return;
    }

    saving = true;
    saveState = "saving";
    status = "Saving…";
    try {
      await ingestionJson(ingestionPath($snapshot.project.id, ""), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      const response = await ingestionJson<IngestionConfigResponse>(
        ingestionPath($snapshot.project.id, ""),
      );
      loadedConfig = response;
      // Concurrent scheduleSave during the await leaves dirty + a pending timer.
      if ((saveState as SaveState) !== "dirty") {
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

  onDestroy(() => {
    if (saveTimer) window.clearTimeout(saveTimer);
    if (saveState === "dirty") void saveNow();
  });
</script>

<section
  class="h-full overflow-y-auto p-4 sm:p-6"
  data-ingestion-brand-settings
>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-5">
    {#if isWeb}
      <Alert.Root>
        <FileCode2 />
        <Alert.Title>Local server required</Alert.Title>
        <Alert.Description
          >Brand matching settings are available only through the local server.</Alert.Description
        >
      </Alert.Root>
    {:else if !config}
      <BrandSettingsSkeleton />
    {:else}
      <div class="flex min-w-0 flex-col gap-6">
        <p class="text-sm text-muted-foreground">
          Brandfetch Logo API adds logos for merchants with a known domain.
          Stored project assets are served locally; other logos redirect through
          the browser so Brandfetch can validate the originating site.
        </p>

        <article
          class="overflow-hidden rounded-xl border border-border bg-background p-4 text-foreground shadow-sm sm:p-6"
          data-ingestion-brand-surface
        >
          <div class="beancount-structured-form">
            <StructuredForm
              value={config}
              config={brandSettingsToggleForm}
              context={formContext}
              onChange={updateConfig}
            />
            {#if config.brandfetch}
              <StructuredForm
                value={config}
                config={brandSettingsForm}
                context={formContext}
                {issues}
                onChange={updateConfig}
              />
            {/if}
          </div>
          <p class="mt-3 text-sm text-muted-foreground">
            High-resolution logos use 120×120 images instead of 40×40 for
            sharper high-DPI displays. Set Cache User-Agent to opt into testing
            server-side cache fills; failed requests still redirect in the
            browser.
          </p>
        </article>

        <div>
          <Button
            type="button"
            variant="link"
            class="h-auto gap-1 px-0 text-sm"
            onclick={openSources}
          >
            Manage sources
            <ArrowRight class="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    {/if}

    {#if status}
      <p class="text-sm text-muted-foreground" role="status">{status}</p>
    {/if}
  </div>
</section>
