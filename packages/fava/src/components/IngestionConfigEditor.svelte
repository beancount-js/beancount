<script lang="ts">
  import { onMount } from "svelte";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import type { IngestionConfigResponse } from "../ingestion/types";

  const { snapshot } = useStudioWorkspace();
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  let contents = "";
  let status = "";
  let loadedProjectId = "";
  let saving = false;

  const example = {
    version: 1,
    sources: [
      {
        id: "bank",
        name: "My bank",
        kind: "json-api",
        sourceAccount: "Assets:Bank:Checking",
        defaultCurrency: "GBP",
        aiEnabled: false,
        merchantEnrichment: {
          enabled: true,
          aiEnabled: false,
          countryCode: "GB",
          brandfetch: {
            enabled: false,
            apiKeySecretRef: "env:BRANDFETCH_API_KEY",
            assetMode: "hotlink",
          },
        },
        api: {
          endpoint: "https://api.example.com/transactions",
          allowedHosts: ["api.example.com"],
          secretRef: "env:BANK_API_TOKEN",
          recordsPath: "transactions",
          pagination: {
            cursorQueryParam: "cursor",
            nextCursorPath: "next_cursor",
          },
        },
        mapping: {
          id: "id",
          date: "booked_at",
          amount: "amount.value",
          currency: "amount.currency",
          merchant: "merchant.name",
          narration: "description",
          status: "status",
        },
        rules: [{ merchant: "Tesco", account: "Expenses:Food:Groceries" }],
      },
    ],
  };

  async function load() {
    if (!$snapshot || isWeb) return;
    try {
      const config = await ingestionJson<IngestionConfigResponse>(
        ingestionPath($snapshot.project.id),
      );
      contents = JSON.stringify(
        {
          version: config.version,
          sources: config.sources.map(
            ({
              credentialAvailable,
              merchantCredentialAvailable,
              allowedAccounts,
              ...source
            }) => source,
          ),
        },
        null,
        2,
      );
      loadedProjectId = $snapshot.project.id;
      status =
        "Credentials use environment references such as env:BANK_API_TOKEN; token values are never saved here.";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    }
  }

  async function save() {
    if (!$snapshot) return;
    saving = true;
    try {
      const config = JSON.parse(contents);
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

  function useExample() {
    contents = JSON.stringify(example, null, 2);
  }

  $: if ($snapshot && !isWeb && loadedProjectId !== $snapshot.project.id)
    void load();
  onMount(() => void load());
</script>

<div class="h-full overflow-auto p-5">
  <div class="mx-auto flex max-w-5xl flex-col gap-4">
    <div>
      <h1 class="text-xl font-semibold">Import Editor</h1>
      <p class="text-sm text-muted-foreground">
        Configure JSON API sources, field mappings, merchant rules, optional AI
        categorization, and merchant enrichment. Brandfetch keys use env:
        references and are never saved here.
      </p>
    </div>
    {#if isWeb}
      <div
        class="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
      >
        Remote ingestion settings are available only through the local server.
      </div>
    {:else}
      <div class="flex gap-2">
        <button class="rounded border px-3 py-2 text-sm" onclick={useExample}
          >Use example</button
        >
        <button
          class="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          disabled={saving}
          onclick={save}>Save sources</button
        >
        <a class="rounded border px-3 py-2 text-sm" href="#/records"
          >Review imports</a
        >
      </div>
      <textarea
        class="min-h-[560px] w-full rounded-md border bg-background p-3 font-mono text-sm"
        bind:value={contents}
        spellcheck="false"
      ></textarea>
    {/if}
    {#if status}<p class="text-sm text-muted-foreground">{status}</p>{/if}
  </div>
</div>
