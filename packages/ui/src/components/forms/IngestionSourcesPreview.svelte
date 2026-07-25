<script lang="ts">
  import ArrowRight from "lucide-svelte/icons/arrow-right";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import RefreshCw from "lucide-svelte/icons/refresh-cw";
  import AccountAvatar from "./AccountAvatar.svelte";
  import FilterCommandPicker from "./FilterCommandPicker.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";
  import { accountAvatarInitial } from "./account-avatar";
  import { Badge } from "../shadcn/badge";
  import { Button } from "../shadcn/button";
  import { Input } from "../shadcn/input";

  type SecretMode = "env" | "inline";

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

  type IngestionConnectionStatus = {
    connected: boolean;
    lastSyncedAt?: string;
    syncing?: boolean;
    failed?: boolean;
  };

  type IngestionPreviewAccount = {
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
    accounts: readonly IngestionPreviewAccount[];
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

  let {
    sources,
    samples = [],
    envKeys = [],
    onConnectSample,
    onManageAccounts,
    onSave,
    onSync,
    onSecretModeChange,
    onSecretValueChange,
    onBaseUrlChange,
    onEndpointChange,
    saving = false,
  }: {
    sources: readonly IngestionSourcePreview[];
    samples?: readonly IngestionSample[];
    envKeys?: readonly string[];
    onConnectSample?: (sample: IngestionSample) => void;
    onManageAccounts?: (index: number) => void;
    onSave: () => void | Promise<void>;
    onSync?: (index: number) => void;
    onSecretModeChange: (index: number, nextMode: SecretMode) => void;
    onSecretValueChange: (
      index: number,
      nextValue: string,
      mode: SecretMode,
    ) => void;
    onBaseUrlChange: (index: number, baseUrl: string) => void;
    onEndpointChange: (index: number, endpoint: string) => void;
  } = $props();

  const envOptions = $derived(
    envKeys.map((key) => ({ value: key, label: key })),
  );

  let openById = $state<Record<string, boolean>>({});
  let failedMerchantLogoIds = $state(new Set<string>());

  function sourceKey(source: IngestionSourcePreview) {
    return source.key;
  }

  function isOpen(source: IngestionSourcePreview) {
    return openById[sourceKey(source)] ?? false;
  }

  function toggle(source: IngestionSourcePreview) {
    const key = sourceKey(source);
    openById = { ...openById, [key]: !isOpen(source) };
  }

  function markMerchantLogoFailed(merchantId: string) {
    failedMerchantLogoIds = new Set([...failedMerchantLogoIds, merchantId]);
  }

  function relativeSyncTime(iso?: string) {
    if (!iso) return "Not synced yet";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "Not synced yet";
    const minutes = Math.floor((Date.now() - then) / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    return new Date(iso).toLocaleDateString();
  }

  function syncLabel(status: IngestionConnectionStatus) {
    if (status.syncing) return "Syncing…";
    if (status.lastSyncedAt) {
      return `Synced ${relativeSyncTime(status.lastSyncedAt)}`;
    }
    return "Not synced yet";
  }

  function sourceStatus(source: IngestionSourcePreview) {
    return source.status;
  }
</script>

<div class="flex min-w-0 flex-col gap-8" data-ingestion-sources-preview>
  <div class="flex min-w-0 flex-col gap-4">
    <p
      class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
    >
      Your connections · {sources.length}
    </p>

    {#each sources as source, index (sourceKey(source))}
      {@const open = isOpen(source)}
      {@const customSetup = source.setupHtml}
      {@const status = sourceStatus(source)}
      <article
        class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
        data-ingestion-connection-card
      >
        <div
          class="group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-expanded={open}
            onclick={() => toggle(source)}
          >
            <ChevronDown
              class="size-4 shrink-0 text-muted-foreground transition-transform {open
                ? ''
                : '-rotate-90'}"
              aria-hidden="true"
            />
            {#if source.merchantLogoUrl &&
              source.merchantId &&
              !failedMerchantLogoIds.has(source.merchantId)}
              <span
                class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted shadow-sm"
                aria-hidden="true"
              >
                <img
                  class="size-full object-cover"
                  src={source.merchantLogoUrl}
                  alt=""
                  onerror={() => markMerchantLogoFailed(source.merchantId ?? "")}
                />
              </span>
            {:else}
              <span
                class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-200 text-sm font-semibold text-rose-800"
                aria-hidden="true"
              >
                {accountAvatarInitial(source.name)}
              </span>
            {/if}
            <span class="min-w-0 truncate text-sm font-semibold">
              {source.name || "Untitled source"}
            </span>
            <Badge
              variant="secondary"
              class="ml-auto shrink-0 tabular-nums"
              aria-label={`${source.accountCount} linked accounts`}
            >
              {source.accountCount}
            </Badge>
          </button>

          <div class="flex shrink-0 items-center gap-3">
            <span class="hidden text-sm text-muted-foreground sm:block">
              {syncLabel(status)}
            </span>
            {#if status.failed}
              <Badge variant="destructive">Sync failed</Badge>
            {:else if status.connected}
              <Badge
                variant="outline"
                class="gap-1 border-primary/30 bg-primary/10 text-primary"
              >
                <span
                  class="size-1.5 rounded-full bg-primary"
                  aria-hidden="true"
                ></span>
                Connected
              </Badge>
            {:else}
              <Badge variant="secondary">Needs setup</Badge>
            {/if}
            {#if onSync && status.connected}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="size-8"
                aria-label={`Sync ${source.name || "source"}`}
                disabled={status.syncing}
                onclick={() => onSync(index)}
              >
                <RefreshCw
                  data-icon
                  class={status.syncing ? "animate-spin" : ""}
                />
              </Button>
            {/if}
          </div>
        </div>

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
                    {#if source.setupHref}
                      <a
                        class="font-medium text-foreground underline underline-offset-2"
                        href={source.setupHref}
                        target="_blank"
                        rel="noreferrer">{source.setupHost}</a
                      >
                    {:else}
                      <span class="font-medium text-foreground"
                        >{source.setupHost}</span
                      >
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
                    value={source.secretMode}
                    options={["env", "inline"]}
                    labels={{ env: "Environment", inline: "Inline" }}
                    ariaLabel={`API Key source for ${source.name || "source"}`}
                    onChange={(next) => {
                      const nextMode = next as SecretMode;
                      if (nextMode === source.secretMode) return;
                      onSecretModeChange(index, nextMode);
                    }}
                  />
                  {#if source.secretMode === "env"}
                    <FilterCommandPicker
                      value={source.secretDisplayValue}
                      options={envOptions}
                      allowCustom={true}
                      fullWidth={true}
                      label="Environment variable"
                      placeholder="Search project .env keys..."
                      emptyLabel="No matching .env keys. Type a custom name."
                      ariaLabel={`API Key for ${source.name || "source"}`}
                      onChange={(next) =>
                        onSecretValueChange(index, next, source.secretMode)}
                    />
                  {:else}
                    <Input
                      type="password"
                      autocomplete="off"
                      spellcheck={false}
                      aria-label={`API Key for ${source.name || "source"}`}
                      placeholder="Paste API key"
                      value={source.secretDisplayValue}
                      oninput={(event) =>
                        onSecretValueChange(
                          index,
                          (event.currentTarget as HTMLInputElement).value,
                          source.secretMode,
                        )}
                    />
                  {/if}
                </div>
              </label>

              {#if source.grouped}
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
                    value={source.baseUrl ?? ""}
                    oninput={(event) =>
                      onBaseUrlChange(
                        index,
                        (event.currentTarget as HTMLInputElement).value,
                      )}
                  />
                </label>

                {#if source.accounts.length}
                  <div class="flex flex-col gap-1.5">
                    <span class="text-xs font-medium text-muted-foreground"
                      >Linked accounts</span
                    >
                    <ul class="flex flex-col gap-2" role="list">
                      {#each source.accounts as account (account.id)}
                        <li
                          class="relative rounded-lg border border-border px-3 py-2 text-sm transition-colors even:bg-muted/40 hover:bg-accent/60"
                        >
                          <a
                            href={account.href}
                            class="absolute inset-0 z-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Open ${account.sourceAccount}`}
                          ></a>
                          <div
                            class="pointer-events-none relative z-10 flex min-w-0 items-center gap-3"
                          >
                            <AccountAvatar
                              account={account.sourceAccount}
                              color={account.color}
                              icon={account.icon}
                              merchantLogoUrl={account.merchantLogoUrl}
                              size="sm"
                            />
                            <span class="min-w-0 flex-1">
                              <span class="block truncate font-medium"
                                >{account.name}</span
                              >
                              <span
                                class="block truncate text-xs text-muted-foreground"
                              >
                                {account.sourceAccount}
                              </span>
                            </span>
                            {#if account.defaultCurrency}
                              <span
                                class="shrink-0 self-center text-xs text-muted-foreground"
                                >{account.defaultCurrency}</span
                              >
                            {/if}
                          </div>
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
                    onclick={() => onManageAccounts(index)}
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
                    value={source.endpoint ?? ""}
                    oninput={(event) =>
                      onEndpointChange(
                        index,
                        (event.currentTarget as HTMLInputElement).value,
                      )}
                  />
                </label>
              {/if}

              <Button
                type="button"
                class="w-full"
                disabled={saving}
                onclick={() => void onSave()}
              >
                {saving ? "Saving…" : "Update connection"}
              </Button>
            </div>
          </div>
        {/if}
      </article>
    {:else}
      <p class="text-sm text-muted-foreground">
        No connections yet. Connect a sample below or switch to edit mode.
      </p>
    {/each}
  </div>

  {#if samples.length}
    <div class="flex min-w-0 flex-col gap-4" data-ingestion-samples>
      <p
        class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        Available · {samples.length}
      </p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {#each samples as sample (sample.id)}
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
                onclick={() => onConnectSample?.(sample)}
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

<style>
  :global(.beancount-structured-form) {
    display: grid;
  }
</style>
