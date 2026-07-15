<script lang="ts">
  import { SegmentedControl } from "@beancount-js/forms";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import type { IngestionSample } from "../ingestion/samples";
  import {
    isSecretConfigured,
    secretDisplayValue,
    secretMode,
    secretStoredValue,
    type SecretMode,
  } from "../ingestion/secret-ref";
  import {
    sourceFromSample,
    type EditableIngestionSource,
  } from "../ingestion/source-form";
  import ComboBox from "./ComboBox.svelte";
  import { untrack } from "svelte";

  type DiscoveredAccount = {
    id: string;
    name: string;
    currency?: string;
    institutionName?: string;
    status?: string;
    iban?: string;
  };

  type Step = "api-key" | "accounts" | "mapping";

  let {
    sample,
    ledgerAccounts = [],
    existingAccountIds = [],
    onCancel,
    onComplete,
  }: {
    sample: IngestionSample;
    ledgerAccounts?: string[];
    existingAccountIds?: string[];
    onCancel: () => void;
    onComplete: (source: EditableIngestionSource) => void;
  } = $props();

  const { snapshot } = useStudioWorkspace();

  let step = $state<Step>("api-key");
  // Intentional one-shot init from the sample prop for this dialog lifetime.
  let secretRef = $state(
    untrack(() => sample.template.api.secretRef ?? ""),
  );
  let loading = $state(false);
  let error = $state("");
  let discovered = $state<DiscoveredAccount[]>([]);
  let selectedIds = $state<string[]>([]);
  let sourceAccounts = $state<Record<string, string>>({});

  const provider = $derived(sample.provider);
  const mode = $derived(secretMode(secretRef));
  const existingSet = $derived(new Set(existingAccountIds));
  const selectableAccounts = $derived(
    discovered.filter((account) => account.name.trim()),
  );
  const selectedAccounts = $derived(
    selectableAccounts.filter((account) => selectedIds.includes(account.id)),
  );
  const accountItems = $derived(
    ledgerAccounts.map((account) => ({ label: account, value: account })),
  );
  const canLoad = $derived(isSecretConfigured(secretRef) && Boolean(provider));
  const canMap = $derived(selectedAccounts.length > 0);
  const canConfirm = $derived(
    selectedAccounts.length > 0 &&
      selectedAccounts.every((account) =>
        Boolean(sourceAccounts[account.id]?.trim()),
      ),
  );

  function updateSecret(next: string) {
    secretRef = next;
    error = "";
  }

  function toggleAccount(id: string, checked: boolean) {
    if (existingSet.has(id)) return;
    if (checked) {
      if (!selectedIds.includes(id)) selectedIds = [...selectedIds, id];
      return;
    }
    selectedIds = selectedIds.filter((item) => item !== id);
    const { [id]: _removed, ...rest } = sourceAccounts;
    sourceAccounts = rest;
  }

  function setSourceAccount(id: string, value: string) {
    sourceAccounts = { ...sourceAccounts, [id]: value };
  }

  async function loadAccounts() {
    if (!provider || !$snapshot) {
      error = "Project is not ready.";
      return;
    }
    if (!isSecretConfigured(secretRef)) {
      error = "Enter an API key or environment variable name.";
      return;
    }
    loading = true;
    error = "";
    try {
      const template = sample.template;
      const response = await ingestionJson<{ accounts: DiscoveredAccount[] }>(
        ingestionPath($snapshot.project.id, "/discover"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            baseUrl: provider.baseUrl,
            secretRef,
            authScheme: template.api.authScheme,
            allowedHosts: template.api.allowedHosts,
            accountsPath: provider.accountsPath,
          }),
        },
      );
      const accounts = response.accounts ?? [];
      discovered = accounts;
      selectedIds = [];
      sourceAccounts = {};
      step = "accounts";
      if (!accounts.some((account) => account.name.trim())) {
        error = "No accounts were returned for this API key.";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  function goToMapping() {
    if (!canMap) {
      error = "Select at least one account.";
      return;
    }
    error = "";
    step = "mapping";
  }

  function confirm() {
    if (!canConfirm) {
      error = "Map each selected account to a Beancount source account.";
      return;
    }
    const template = sample.template;
    const source = sourceFromSample(template, []);
    source.api = { ...source.api, secretRef };
    source.accounts = selectedAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      sourceAccount: sourceAccounts[account.id]!.trim(),
      defaultCurrency: account.currency,
    }));
    onComplete(source);
  }

  function onOpenChange(open: boolean) {
    if (!open) onCancel();
  }
</script>

<Dialog.Root open={true} {onOpenChange}>
  <Dialog.Content class="flex max-h-[85vh] flex-col gap-4 sm:max-w-lg">
    <Dialog.Header>
      <Dialog.Title>Connect {sample.name}</Dialog.Title>
      <Dialog.Description>
        {#if step === "api-key"}
          Enter your API key, then load accounts from {sample.name}.
        {:else if step === "accounts"}
          Choose which bank accounts to import.
        {:else}
          Map each account to a Beancount source account.
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
      {#if step === "api-key"}
        <label class="flex flex-col gap-1.5">
          <span class="text-xs font-medium text-muted-foreground">API Key</span>
          <div class="flex flex-col items-stretch gap-2">
            <SegmentedControl
              value={mode}
              options={["env", "inline"]}
              labels={{ env: "Environment", inline: "Inline" }}
              ariaLabel={`API Key source for ${sample.name}`}
              onChange={(next) => {
                const nextMode = next as SecretMode;
                if (nextMode === mode) return;
                updateSecret(secretStoredValue(nextMode, ""));
              }}
            />
            <Input
              type={mode === "inline" ? "password" : "text"}
              autocomplete="off"
              spellcheck={false}
              aria-label={`API Key for ${sample.name}`}
              placeholder={mode === "env" ? "BANK_API_TOKEN" : "Paste API key"}
              value={secretDisplayValue(secretRef)}
              oninput={(event) =>
                updateSecret(
                  secretStoredValue(
                    mode,
                    (event.currentTarget as HTMLInputElement).value,
                  ),
                )}
            />
          </div>
        </label>
      {:else if step === "accounts"}
        <ul class="flex flex-col gap-2" role="list">
          {#each selectableAccounts as account (account.id)}
            {@const linked = existingSet.has(account.id)}
            {@const checked = selectedIds.includes(account.id)}
            <li>
              <label
                class="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5 {linked
                  ? 'opacity-60'
                  : ''}"
              >
                <input
                  type="checkbox"
                  class="mt-1 size-4 shrink-0"
                  disabled={linked}
                  {checked}
                  aria-label={`Select ${account.name}`}
                  onchange={(event) =>
                    toggleAccount(
                      account.id,
                      (event.currentTarget as HTMLInputElement).checked,
                    )}
                />
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-medium">{account.name}</span>
                  <span class="mt-0.5 block text-xs text-muted-foreground">
                    {[
                      account.institutionName,
                      account.currency,
                      account.status,
                      linked ? "Already linked" : undefined,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </label>
            </li>
          {:else}
            <li class="text-sm text-muted-foreground">
              No selectable accounts found.
            </li>
          {/each}
        </ul>
      {:else}
        <ul class="flex flex-col gap-3" role="list">
          {#each selectedAccounts as account (account.id)}
            <li class="flex flex-col gap-1.5 rounded-lg border border-border p-3">
              <div class="min-w-0">
                <p class="text-sm font-medium">{account.name}</p>
                <p class="text-xs text-muted-foreground">
                  {[account.institutionName, account.currency]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <label class="flex flex-col gap-1">
                <span class="text-xs font-medium text-muted-foreground"
                  >Source account</span
                >
                <ComboBox
                  items={accountItems}
                  value={sourceAccounts[account.id] ?? ""}
                  placeholder="Select account"
                  onValueChange={(value) => setSourceAccount(account.id, value)}
                />
              </label>
            </li>
          {/each}
        </ul>
      {/if}

      {#if error}
        <p class="text-sm text-destructive" role="alert">{error}</p>
      {/if}
    </div>

    <Dialog.Footer class="gap-2 sm:justify-between">
      <Button type="button" variant="ghost" onclick={onCancel}>Cancel</Button>
      <div class="flex flex-wrap justify-end gap-2">
        {#if step === "api-key"}
          <Button
            type="button"
            disabled={!canLoad || loading}
            onclick={() => void loadAccounts()}
          >
            {loading ? "Loading…" : "Load accounts"}
          </Button>
        {:else if step === "accounts"}
          <Button type="button" variant="outline" onclick={() => (step = "api-key")}
            >Back</Button
          >
          <Button type="button" disabled={!canMap} onclick={goToMapping}
            >Next</Button
          >
        {:else}
          <Button
            type="button"
            variant="outline"
            onclick={() => (step = "accounts")}>Back</Button
          >
          <Button type="button" disabled={!canConfirm} onclick={confirm}
            >Connect</Button
          >
        {/if}
      </div>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
