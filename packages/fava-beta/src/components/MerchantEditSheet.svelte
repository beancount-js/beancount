<script lang="ts">
  import { onDestroy } from "svelte";
  import { MerchantEditSheet as SharedMerchantEditSheet } from "@beancount-js/ui/forms";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import {
    editableMerchantFromDetails,
    merchantDetailsForm,
    validateEditableMerchant,
    type EditableMerchantProfile,
    type MerchantProfileResponse,
  } from "../ingestion/merchant-form-config";
  import type { FormConfig } from "@beancount-js/forms";
  import type { MerchantEditProfile } from "@beancount-js/ui/forms";

  type Props = {
    open?: boolean;
    projectId: string;
    merchantId: string;
    onClosed?: () => void;
    onUpdated?: () => void;
  };

  type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

  let {
    open = $bindable(false),
    projectId,
    merchantId,
    onClosed,
    onUpdated,
  }: Props = $props();

  let merchant = $state<EditableMerchantProfile | undefined>(undefined);
  let loading = $state(false);
  let loadError = $state("");
  let refreshingLogo = $state(false);
  let saveState = $state<SaveState>("idle");
  let status = $state("");
  let saveTimer: number | null = null;
  let loadedKey = $state("");

  const issues = $derived.by(() => {
    return merchant
      ? [...validateEditableMerchant(merchant)]
      : ([] as {
          message: string;
          fieldId?: string;
          path?: string;
          severity?: "error" | "warning" | "info";
        }[]);
  });

  const statusMessage = $derived(
    refreshingLogo
      ? "Refreshing logo…"
      : loadError
        ? loadError
        : saveState === "dirty"
          ? "Unsaved changes…"
          : saveState === "saving"
            ? "Saving…"
            : saveState === "saved"
              ? "Saved."
              : saveState === "error"
                ? status || "Save failed."
                : "",
  );

  const headers = {
    "content-type": "application/json",
  };

  function resetSheetState() {
    merchant = undefined;
    loadError = "";
    refreshingLogo = false;
    saveState = "idle";
    status = "";
    loadedKey = "";
    loading = false;
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
  }

  function patchBody(draft: EditableMerchantProfile) {
    return {
      canonicalName: draft.canonicalName,
      domain: draft.domain,
      description: draft.description,
      industry: draft.industry,
      countryCode: draft.countryCode,
      notes: draft.notes,
    };
  }

  async function loadMerchant() {
    if (!projectId || !merchantId) return;
    loading = true;
    loadError = "";
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveState = "idle";
    status = "";
    try {
      const response = await ingestionJson<MerchantProfileResponse>(
        ingestionPath(
          projectId,
          `/merchants/${encodeURIComponent(merchantId)}`,
        ),
      );
      merchant = editableMerchantFromDetails(response);
    } catch (error) {
      merchant = undefined;
      loadError = error instanceof Error ? error.message : String(error);
      saveState = "error";
    } finally {
      loading = false;
    }
  }

  function updateMerchant(next: EditableMerchantProfile) {
    merchant = next;
    scheduleSave();
  }

  function scheduleSave() {
    if (!open || loading || !merchant) return;
    saveState = "dirty";
    status = "Unsaved changes…";
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      void saveNow();
    }, 1200);
  }

  async function saveNow() {
    if (!merchant || !projectId || !merchantId) return;
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }

    const validationIssues = validateEditableMerchant(merchant);
    if (validationIssues.length) {
      status = "Resolve the highlighted validation errors before saving.";
      saveState = "error";
      return;
    }

    saveState = "saving";
    status = "Saving…";
    try {
      const response = await ingestionJson<MerchantProfileResponse>(
        ingestionPath(
          projectId,
          `/merchants/${encodeURIComponent(merchantId)}`,
        ),
        {
          method: "PATCH",
          headers,
          body: JSON.stringify(patchBody(merchant)),
        },
      );
      merchant = editableMerchantFromDetails(response);
      onUpdated?.();
      status = "Saved.";
      saveState = "saved";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
      saveState = "error";
    }
  }

  async function refreshLogo() {
    if (!merchant || !projectId || !merchantId) return;
    refreshingLogo = true;
    status = "";
    try {
      const response = await ingestionJson<MerchantProfileResponse>(
        ingestionPath(
          projectId,
          `/merchants/${encodeURIComponent(merchantId)}/refresh`,
        ),
        { method: "POST" },
      );
      merchant = editableMerchantFromDetails(response);
      onUpdated?.();
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
      saveState = "error";
    } finally {
      refreshingLogo = false;
    }
  }

  function handleOpenChange(next: boolean) {
    open = next;
    if (!next) {
      resetSheetState();
      onClosed?.();
    }
  }

  $effect(() => {
    const key = `${open}:${projectId}:${merchantId}`;
    if (open && projectId && merchantId) {
      if (key !== loadedKey) {
        loadedKey = key;
        void loadMerchant();
      }
      return;
    }
    if (!open && loadedKey) {
      loadedKey = "";
    }
  });

  onDestroy(() => {
    if (saveTimer) window.clearTimeout(saveTimer);
    if (saveState === "dirty") void saveNow();
  });
</script>

<SharedMerchantEditSheet
  bind:open
  {merchant}
  {loading}
  {loadError}
  {refreshingLogo}
  status={statusMessage}
  detailsForm={merchantDetailsForm as unknown as FormConfig<MerchantEditProfile>}
  {issues}
  onOpenChange={handleOpenChange}
  onChange={(next) => {
    updateMerchant(next as EditableMerchantProfile);
  }}
  onRefreshLogo={refreshLogo}
/>
