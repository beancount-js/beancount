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

<div
  class="cn-forms-ingestionsourcespreview-149-1"
  data-ingestion-sources-preview
>
  <div class="cn-forms-ingestionsourcespreview-150-1">
    <p class="cn-forms-ingestionsourcespreview-152-1">
      Your connections · {sources.length}
    </p>

    {#each sources as source, index (sourceKey(source))}
      {@const open = isOpen(source)}
      {@const customSetup = source.setupHtml}
      {@const status = sourceStatus(source)}
      <article
        class="cn-forms-ingestionsourcespreview-162-1"
        data-ingestion-connection-card
      >
        <div class="cn-forms-ingestionsourcespreview-166-1 cn-group">
          <button
            type="button"
            class="cn-forms-ingestionsourcespreview-170-1"
            aria-expanded={open}
            onclick={() => toggle(source)}
          >
            <ChevronDown
              class="cn-forms-ingestionsourcespreview-175-2 cn-forms-ingestionsourcespreview-175-1 cn-forms-ingestionsourcespreview-175-3 cn-forms-ingestionsourcespreview-175-4 {open
                ? ''
                : '-rotate-90'}"
              aria-hidden="true"
            />
            {#if source.merchantLogoUrl && source.merchantId && !failedMerchantLogoIds.has(source.merchantId)}
              <span
                class="cn-forms-ingestionsourcespreview-184-1"
                aria-hidden="true"
              >
                <img
                  class="cn-forms-ingestionsourcespreview-188-1"
                  src={source.merchantLogoUrl}
                  alt=""
                  onerror={() =>
                    markMerchantLogoFailed(source.merchantId ?? "")}
                />
              </span>
            {:else}
              <span
                class="cn-forms-ingestionsourcespreview-196-1"
                aria-hidden="true"
              >
                {accountAvatarInitial(source.name)}
              </span>
            {/if}
            <span class="cn-forms-ingestionsourcespreview-202-1">
              {source.name || "Untitled source"}
            </span>
            <Badge
              variant="secondary"
              class="cn-forms-ingestionsourcespreview-207-1"
              aria-label={`${source.accountCount} linked accounts`}
            >
              {source.accountCount}
            </Badge>
          </button>

          <div class="cn-forms-ingestionsourcespreview-214-1">
            <span class="cn-forms-ingestionsourcespreview-215-1">
              {syncLabel(status)}
            </span>
            {#if status.failed}
              <Badge variant="destructive">Sync failed</Badge>
            {:else if status.connected}
              <Badge
                variant="outline"
                class="cn-forms-ingestionsourcespreview-223-1"
              >
                <span
                  class="cn-forms-ingestionsourcespreview-226-1"
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
                class="cn-forms-ingestionsourcespreview-239-1"
                aria-label={`Sync ${source.name || "source"}`}
                disabled={status.syncing}
                onclick={() => onSync(index)}
              >
                <RefreshCw
                  data-icon
                  class={status.syncing
                    ? "cn-forms-ingestionsourcespreview-246-1"
                    : ""}
                />
              </Button>
            {/if}
          </div>
        </div>

        {#if open}
          <div class="cn-forms-ingestionsourcespreview-255-1">
            <div class="cn-forms-ingestionsourcespreview-258-1">
              <p class="cn-forms-ingestionsourcespreview-261-1">Setup</p>
              {#if customSetup}
                <div class="cn-forms-ingestionsourcespreview-266-1">
                  {@html customSetup}
                </div>
              {:else}
                <ol class="cn-forms-ingestionsourcespreview-270-1">
                  <li>
                    Go to
                    {#if source.setupHref}
                      <a
                        class="cn-forms-ingestionsourcespreview-275-1"
                        href={source.setupHref}
                        target="_blank"
                        rel="noreferrer">{source.setupHost}</a
                      >
                    {:else}
                      <span class="cn-forms-ingestionsourcespreview-281-1"
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

            <div class="cn-forms-ingestionsourcespreview-296-1">
              <label class="cn-forms-ingestionsourcespreview-297-1">
                <span class="cn-forms-ingestionsourcespreview-298-1"
                  >API Key</span
                >
                <div class="cn-forms-ingestionsourcespreview-301-1">
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
                <label class="cn-forms-ingestionsourcespreview-346-1">
                  <span class="cn-forms-ingestionsourcespreview-347-1"
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
                  <div class="cn-forms-ingestionsourcespreview-366-1">
                    <span class="cn-forms-ingestionsourcespreview-367-1"
                      >Linked accounts</span
                    >
                    <ul
                      class="cn-forms-ingestionsourcespreview-370-1"
                      role="list"
                    >
                      {#each source.accounts as account (account.id)}
                        <li class="cn-forms-ingestionsourcespreview-373-1">
                          <a
                            href={account.href}
                            class="cn-forms-ingestionsourcespreview-377-1"
                            aria-label={`Open ${account.sourceAccount}`}
                          ></a>
                          <div class="cn-forms-ingestionsourcespreview-381-1">
                            <AccountAvatar
                              account={account.sourceAccount}
                              color={account.color}
                              icon={account.icon}
                              merchantLogoUrl={account.merchantLogoUrl}
                              size="sm"
                            />
                            <span
                              class="cn-forms-ingestionsourcespreview-390-1"
                            >
                              <span
                                class="cn-forms-ingestionsourcespreview-391-1"
                                >{account.name}</span
                              >
                              <span
                                class="cn-forms-ingestionsourcespreview-395-1"
                              >
                                {account.sourceAccount}
                              </span>
                            </span>
                            {#if account.defaultCurrency}
                              <span
                                class="cn-forms-ingestionsourcespreview-402-1"
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
                    class="cn-forms-ingestionsourcespreview-417-1"
                    onclick={() => onManageAccounts(index)}
                  >
                    Manage accounts
                    <ArrowRight
                      class="cn-forms-ingestionsourcespreview-421-1"
                      aria-hidden="true"
                    />
                  </Button>
                {/if}
              {:else}
                <label class="cn-forms-ingestionsourcespreview-425-1">
                  <span class="cn-forms-ingestionsourcespreview-426-1"
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
                class="cn-forms-ingestionsourcespreview-447-1"
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
      <p class="cn-forms-ingestionsourcespreview-458-1">
        No connections yet. Connect a sample below or switch to edit mode.
      </p>
    {/each}
  </div>

  {#if samples.length}
    <div class="cn-forms-ingestionsourcespreview-465-1" data-ingestion-samples>
      <p class="cn-forms-ingestionsourcespreview-467-1">
        Available · {samples.length}
      </p>
      <div class="cn-forms-ingestionsourcespreview-471-1">
        {#each samples as sample (sample.id)}
          <article
            class="cn-forms-ingestionsourcespreview-474-1"
            data-ingestion-sample-card
          >
            <div class="cn-forms-ingestionsourcespreview-477-1">
              <div
                class="cn-forms-ingestionsourcespreview-479-1"
                aria-hidden="true"
              >
                {sample.initials}
              </div>
              <div class="cn-forms-ingestionsourcespreview-484-1">
                <div class="cn-forms-ingestionsourcespreview-485-1">
                  <h3 class="cn-forms-ingestionsourcespreview-486-1">
                    {sample.name}
                  </h3>
                  {#if sample.badge}
                    <span class="cn-forms-ingestionsourcespreview-489-1"
                      >{sample.badge}</span
                    >
                  {/if}
                </div>
                <p class="cn-forms-ingestionsourcespreview-494-1">
                  {sample.region} · {sample.category}
                </p>
              </div>
            </div>
            <p class="cn-forms-ingestionsourcespreview-499-1">
              {sample.description}
            </p>
            <div class="cn-forms-ingestionsourcespreview-502-1">
              <Button
                type="button"
                variant="link"
                class="cn-forms-ingestionsourcespreview-506-1"
                aria-label={`Connect ${sample.name}`}
                onclick={() => onConnectSample?.(sample)}
              >
                Connect
                <ArrowRight
                  class="cn-forms-ingestionsourcespreview-511-1"
                  aria-hidden="true"
                />
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
