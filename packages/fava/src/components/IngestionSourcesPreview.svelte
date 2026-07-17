<script lang="ts">
  import ArrowRight from "lucide-svelte/icons/arrow-right";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import { FilterCommandPicker, SegmentedControl } from "@beancount-js/forms";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import {
    isConnectorSource,
    isGroupedSource,
    sourceBaseUrl,
    sourceSecretRef,
  } from "../ingestion/connectors";
  import {
    availableIngestionSamples,
    type IngestionSample,
  } from "../ingestion/samples";
  import type { EditableIngestionSource } from "../ingestion/source-form";
  import {
    secretDisplayValue,
    secretMode,
    secretStoredValue,
    type SecretMode,
  } from "../ingestion/secret-ref";
  import {
    renderSetupMarkdown,
    setupHost,
    setupHref,
  } from "../ingestion/setup-markdown";

  let {
    sources,
    samples = [],
    envKeys = [],
    onChange,
    onSave,
    onConnectSample,
    onManageAccounts,
    saving = false,
  }: {
    sources: EditableIngestionSource[];
    samples?: IngestionSample[];
    envKeys?: string[];
    onChange: (index: number, next: EditableIngestionSource) => void;
    onSave: () => void | Promise<void>;
    onConnectSample?: (sample: IngestionSample) => void;
    onManageAccounts?: (source: EditableIngestionSource) => void;
    saving?: boolean;
  } = $props();

  const envOptions = $derived(
    envKeys.map((key) => ({ value: key, label: key })),
  );
  const availableSamples = $derived(
    availableIngestionSamples(sources, samples),
  );

  let openById = $state<Record<string, boolean>>({});

  function sourceKey(source: EditableIngestionSource, index: number) {
    return source.id || `source-${index}`;
  }

  function isOpen(source: EditableIngestionSource, index: number) {
    const key = sourceKey(source, index);
    return openById[key] ?? true;
  }

  function toggle(source: EditableIngestionSource, index: number) {
    const key = sourceKey(source, index);
    openById = { ...openById, [key]: !isOpen(source, index) };
  }

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

  function updateSecret(
    index: number,
    source: EditableIngestionSource,
    secretRef: string,
  ) {
    onChange(
      index,
      isConnectorSource(source)
        ? withConfig(source, { secretRef })
        : withApi(source, { secretRef }),
    );
  }

  function updateEndpoint(
    index: number,
    source: EditableIngestionSource,
    endpoint: string,
  ) {
    onChange(index, withApi(source, { endpoint }));
  }

  function updateBaseUrl(
    index: number,
    source: EditableIngestionSource,
    baseUrl: string,
  ) {
    onChange(
      index,
      isConnectorSource(source)
        ? withConfig(source, { baseUrl })
        : withApi(source, { baseUrl }),
    );
  }

  function setupHtml(source: EditableIngestionSource) {
    const markdown = source.setup?.trim();
    return markdown ? renderSetupMarkdown(markdown) : "";
  }

  function previewUrl(source: EditableIngestionSource) {
    return sourceBaseUrl(source) || source.api?.endpoint || "";
  }
</script>

<div class="flex min-w-0 flex-col gap-8" data-ingestion-sources-preview>
  <div class="flex min-w-0 flex-col gap-4">
    <p
      class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
    >
      Your connections · {sources.length}
    </p>

    {#each sources as source, index (sourceKey(source, index))}
      {@const open = isOpen(source, index)}
      {@const url = previewUrl(source)}
      {@const host = setupHost(url)}
      {@const href = setupHref(url)}
      {@const customSetup = setupHtml(source)}
      {@const secretRef = sourceSecretRef(source)}
      {@const mode = secretMode(secretRef)}
      {@const grouped = isGroupedSource(source)}
      <article
        class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
        data-ingestion-connection-card
      >
        <button
          type="button"
          class="flex w-full items-center gap-2 px-4 py-3 text-left"
          aria-expanded={open}
          onclick={() => toggle(source, index)}
        >
          <ChevronDown
            class="size-4 shrink-0 text-muted-foreground transition-transform {open
              ? ''
              : '-rotate-90'}"
            aria-hidden="true"
          />
          <span class="min-w-0 truncate text-sm font-semibold">
            {source.name || "Untitled source"}
          </span>
        </button>

        {#if open}
          <div
            class="flex flex-col gap-4 border-t border-border px-4 pb-4 pt-3"
          >
            <div
              class="rounded-lg bg-muted/60 px-3 py-3 text-sm text-muted-foreground"
            >
              <p
                class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Setup
              </p>
              {#if customSetup}
                <div class="space-y-2 [&_p]:leading-relaxed">
                  {@html customSetup}
                </div>
              {:else}
                <ol class="list-decimal space-y-1 pl-4">
                  <li>
                    Go to
                    {#if href}
                      <a
                        class="font-medium text-foreground underline underline-offset-2"
                        {href}
                        target="_blank"
                        rel="noreferrer">{host}</a
                      >
                    {:else}
                      <span class="font-medium text-foreground">{host}</span>
                    {/if}
                    and create an API key.
                  </li>
                  <li>
                    Paste your API key below (or switch to Environment and enter
                    a variable name) and connect.
                  </li>
                  <li>Then head to Review imports to fetch and categorise.</li>
                </ol>
              {/if}
            </div>

            <div class="flex flex-col gap-3">
              <label class="flex flex-col gap-1.5">
                <span class="text-xs font-medium text-muted-foreground"
                  >API Key</span
                >
                <div class="flex flex-col items-stretch gap-2">
                  <SegmentedControl
                    value={mode}
                    options={["env", "inline"]}
                    labels={{ env: "Environment", inline: "Inline" }}
                    ariaLabel={`API Key source for ${source.name || "source"}`}
                    onChange={(next) => {
                      const nextMode = next as SecretMode;
                      if (nextMode === mode) return;
                      updateSecret(
                        index,
                        source,
                        secretStoredValue(nextMode, ""),
                      );
                    }}
                  />
                  {#if mode === "env"}
                    <FilterCommandPicker
                      value={secretDisplayValue(secretRef)}
                      options={envOptions}
                      allowCustom={true}
                      fullWidth={true}
                      label="Environment variable"
                      placeholder="Search project .env keys..."
                      emptyLabel="No matching .env keys. Type a custom name."
                      ariaLabel={`API Key for ${source.name || "source"}`}
                      onChange={(next) =>
                        updateSecret(
                          index,
                          source,
                          secretStoredValue(mode, next),
                        )}
                    />
                  {:else}
                    <Input
                      type="password"
                      autocomplete="off"
                      spellcheck={false}
                      aria-label={`API Key for ${source.name || "source"}`}
                      placeholder="Paste API key"
                      value={secretDisplayValue(secretRef)}
                      oninput={(event) =>
                        updateSecret(
                          index,
                          source,
                          secretStoredValue(
                            mode,
                            (event.currentTarget as HTMLInputElement).value,
                          ),
                        )}
                    />
                  {/if}
                </div>
              </label>

              {#if grouped}
                <label class="flex flex-col gap-1.5">
                  <span class="text-xs font-medium text-muted-foreground"
                    >Base URL</span
                  >
                  <Input
                    type="url"
                    autocomplete="off"
                    spellcheck={false}
                    aria-label={`Base URL for ${source.name || "source"}`}
                    placeholder="https://api.example.com/v1"
                    value={sourceBaseUrl(source) ?? ""}
                    oninput={(event) =>
                      updateBaseUrl(
                        index,
                        source,
                        (event.currentTarget as HTMLInputElement).value,
                      )}
                  />
                </label>

                {#if source.accounts?.length}
                  <div class="flex flex-col gap-1.5">
                    <span class="text-xs font-medium text-muted-foreground"
                      >Linked accounts</span
                    >
                    <ul class="flex flex-col gap-2" role="list">
                      {#each source.accounts as account (account.id)}
                        <li
                          class="rounded-lg border border-border px-3 py-2 text-sm"
                        >
                          <p class="font-medium">{account.name}</p>
                          <p class="text-xs text-muted-foreground">
                            {[account.sourceAccount, account.defaultCurrency]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {/if}

                {#if onManageAccounts}
                  <Button
                    type="button"
                    variant="link"
                    class="h-auto justify-start gap-1 px-0 text-sm"
                    onclick={() => onManageAccounts(source)}
                  >
                    Manage accounts
                    <ArrowRight class="size-3.5" aria-hidden="true" />
                  </Button>
                {/if}
              {:else}
                <label class="flex flex-col gap-1.5">
                  <span class="text-xs font-medium text-muted-foreground"
                    >Endpoint</span
                  >
                  <Input
                    type="url"
                    autocomplete="off"
                    spellcheck={false}
                    aria-label={`Endpoint for ${source.name || "source"}`}
                    placeholder="https://api.example.com/transactions"
                    value={source.api?.endpoint ?? ""}
                    oninput={(event) =>
                      updateEndpoint(
                        index,
                        source,
                        (event.currentTarget as HTMLInputElement).value,
                      )}
                  />
                </label>
              {/if}
            </div>

            <Button
              type="button"
              class="w-full"
              disabled={saving}
              onclick={() => void onSave()}
            >
              {saving ? "Saving…" : "Update connection"}
            </Button>
          </div>
        {/if}
      </article>
    {:else}
      <p class="text-sm text-muted-foreground">
        No connections yet. Connect a sample below or switch to edit mode.
      </p>
    {/each}
  </div>

  {#if availableSamples.length && onConnectSample}
    <div class="flex min-w-0 flex-col gap-4" data-ingestion-samples>
      <p
        class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Available · {availableSamples.length}
      </p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {#each availableSamples as sample (sample.id)}
          <article
            class="flex min-h-44 flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm transition-colors hover:border-foreground/20 hover:bg-muted/40 hover:shadow-md"
            data-ingestion-sample-card
          >
            <div class="flex items-start gap-3">
              <div
                class="grid size-9 shrink-0 place-items-center rounded-md text-xs font-semibold text-primary-foreground {sample.accentClass}"
                aria-hidden="true"
              >
                {sample.initials}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-sm font-semibold">{sample.name}</h3>
                  {#if sample.badge}
                    <span
                      class="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >{sample.badge}</span
                    >
                  {/if}
                </div>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  {sample.region} · {sample.category}
                </p>
              </div>
            </div>
            <p class="flex-1 text-sm leading-relaxed text-muted-foreground">
              {sample.description}
            </p>
            <div class="flex justify-end">
              <Button
                type="button"
                variant="link"
                class="h-auto gap-1 px-0 text-sm"
                aria-label={`Connect ${sample.name}`}
                onclick={() => onConnectSample(sample)}
              >
                Connect
                <ArrowRight class="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </article>
        {/each}
      </div>
    </div>
  {/if}
</div>
