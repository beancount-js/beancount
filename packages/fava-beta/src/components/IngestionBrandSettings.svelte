<script lang="ts">
  import { onDestroy } from "svelte";
  import { IngestionBrandSettings } from "@lapis/ui/forms";
  import { type FormValidationIssue } from "@lapis/ui/forms";
  import { useNavigation } from "../router/router";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import { brandSettingsForm, brandSettingsToggleForm } from "../ingestion/brand-form-config";
  import {
    editableIngestionConfig,
    validateEditableIngestionConfig,
    type EditableIngestionConfig,
  } from "../ingestion/source-form";
  import type { IngestionConfigResponse } from "../ingestion/types";

  const { snapshot } = useStudioWorkspace();
  const { router } = useNavigation();
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";

  type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

  let config = $state<EditableIngestionConfig | undefined>(undefined);
  let loadedConfig = $state<IngestionConfigResponse | undefined>(undefined);
  let loadedProjectId = $state("");
  let status = $state("");
  let saveState = $state<SaveState>("idle");
  let saveTimer: number | null = null;

  const formContext = $derived({
    accounts: loadedConfig?.accounts ?? [],
    envKeys: $snapshot?.envKeys ?? [],
  } satisfies {
    accounts: string[];
    envKeys?: readonly string[];
  });
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

<IngestionBrandSettings
  {isWeb}
  {config}
  {status}
  {issues}
  formContext={formContext}
  {brandSettingsToggleForm}
  {brandSettingsForm}
  onConfigChange={updateConfig}
  onManageSources={openSources}
/>
