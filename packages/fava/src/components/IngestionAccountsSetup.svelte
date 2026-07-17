<script lang="ts">
  import BookOpen from "lucide-svelte/icons/book-open";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import FileCode2 from "lucide-svelte/icons/file-code-2";
  import Landmark from "lucide-svelte/icons/landmark";
  import Link2 from "lucide-svelte/icons/link-2";
  import MoreVertical from "lucide-svelte/icons/more-vertical";
  import RefreshCw from "lucide-svelte/icons/refresh-cw";
  import Settings from "lucide-svelte/icons/settings";
  import Trash2 from "lucide-svelte/icons/trash-2";
  import type { JsonApiLinkedAccount } from "@beancount-js/beangulp";
  import type { IngestionSyncJob } from "@beancount-js/server";
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import * as Empty from "$lib/components/ui/empty";
  import * as Sheet from "$lib/components/ui/sheet";
  import { useContext } from "../context";
  import { useNavigation } from "../router/router";
  import {
    beginIngestionSync,
    restoreIngestionSyncWatch,
  } from "../studio/sync-status";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import { isSecretConfigured } from "../ingestion/secret-ref";
  import AccountsPageSkeleton from "./skeletons/AccountsPageSkeleton.svelte";
  import {
    isGroupedSource,
    sourceBaseUrl,
    sourceSecretRef,
  } from "../ingestion/connectors";
  import {
    editableIngestionConfig,
    type EditableIngestionConfig,
    type EditableIngestionSource,
  } from "../ingestion/source-form";
  import type { IngestionConfigResponse } from "../ingestion/types";
  import { useCtx } from "../stores/format";
  import ComboBox from "./ComboBox.svelte";

  type DiscoveredAccount = {
    id: string;
    name: string;
    currency?: string;
    institutionName?: string;
    status?: string;
    iban?: string;
  };

  type LinkedGroup = {
    label: string;
    accounts: JsonApiLinkedAccount[];
  };

  const ACCOUNT_AVATAR_COLORS = [
    "bg-rose-200 text-rose-800",
    "bg-orange-200 text-orange-800",
    "bg-amber-200 text-amber-900",
    "bg-sky-200 text-sky-800",
    "bg-violet-200 text-violet-800",
    "bg-teal-200 text-teal-800",
  ] as const;

  const { snapshot, activeFile } = useStudioWorkspace();
  const { ledgerData, conversion } = useContext();
  const { router } = useNavigation();
  const ctx = useCtx();
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";

  let config = $state<EditableIngestionConfig | undefined>(undefined);
  let loadedConfig = $state<IngestionConfigResponse | undefined>(undefined);
  let loadedProjectId = $state("");
  let selectedSourceId = $state("");
  let status = $state("");
  let error = $state("");
  let loading = $state(false);
  let saving = $state(false);
  let discovering = $state(false);
  let discovered = $state<DiscoveredAccount[]>([]);
  let selectedIds = $state<string[]>([]);
  let sourceAccounts = $state<Record<string, string>>({});
  let connectionExpanded = $state(false);
  let syncSummaryOpen = $state(false);
  let setupSheetOpen = $state(false);
  let autoDiscoveredFor = $state("");
  let syncJob = $state<IngestionSyncJob | null>(null);

  const connections = $derived(
    (config?.sources ?? []).filter((source) => isGroupedSource(source)),
  );
  const selectedConnection = $derived(
    connections.find((source) => source.id === selectedSourceId) ??
      connections[0],
  );
  const serverConnection = $derived(
    selectedConnection
      ? loadedConfig?.sources.find((item) => item.id === selectedConnection.id)
      : undefined,
  );
  const linkedAccounts = $derived(selectedConnection?.accounts ?? []);
  const linkedIds = $derived(
    new Set(linkedAccounts.map((account) => account.id)),
  );
  const discoveryById = $derived(
    new Map(discovered.map((account) => [account.id, account])),
  );
  const selectableAccounts = $derived(
    discovered.filter((account) => account.name.trim()),
  );
  const unlinkedAccounts = $derived(
    selectableAccounts.filter((account) => !linkedIds.has(account.id)),
  );
  const selectedAccounts = $derived(
    unlinkedAccounts.filter((account) => selectedIds.includes(account.id)),
  );
  const accountItems = $derived(
    (loadedConfig?.accounts ?? []).map((account) => ({
      label: account,
      value: account,
    })),
  );
  const canDiscover = $derived(
    Boolean(
      selectedConnection &&
        sourceBaseUrl(selectedConnection)?.trim() &&
        isSecretConfigured(sourceSecretRef(selectedConnection)),
    ),
  );
  const canLink = $derived(
    selectedAccounts.length > 0 &&
      selectedAccounts.every((account) =>
        Boolean(sourceAccounts[account.id]?.trim()),
      ),
  );
  const linkedCount = $derived(linkedAccounts.length);
  const unlinkedCount = $derived(unlinkedAccounts.length);
  const totalAccountCount = $derived(
    discovered.length > 0 ? discovered.length : linkedCount,
  );
  const institutionCount = $derived.by(() => {
    const names = new Set<string>();
    for (const account of discovered) {
      const institution = account.institutionName?.trim();
      if (institution) names.add(institution);
    }
    if (names.size === 0) {
      for (const account of linkedAccounts) {
        const fromDiscovery = discoveryById
          .get(account.id)
          ?.institutionName?.trim();
        if (fromDiscovery) {
          names.add(fromDiscovery);
          continue;
        }
        const fallback = account.name.trim();
        if (fallback) names.add(fallback);
      }
    }
    return names.size;
  });
  const discoveryKnown = $derived(discovered.length > 0);
  const connectionStatusLine = $derived.by(() => {
    if (discoveryKnown) {
      const syncPart = `${linkedCount} synced, ${unlinkedCount} need setup`;
      if (institutionCount > 0) {
        const institutions = `${institutionCount} institution${institutionCount === 1 ? "" : "s"}`;
        return `${institutions} • ${syncPart}`;
      }
      return syncPart;
    }
    if (discovering || serverConnection?.credentialAvailable) {
      return "Credential available · Discovering accounts…";
    }
    if (
      isSecretConfigured(
        selectedConnection ? sourceSecretRef(selectedConnection) : undefined,
      )
    ) {
      return "Credential saved · Ready to discover";
    }
    return "No API key configured";
  });
  const linkedGroups = $derived.by((): LinkedGroup[] => {
    const order = ["Cash", "Credit", "Linked"] as const;
    const buckets = new Map<string, JsonApiLinkedAccount[]>();
    for (const label of order) buckets.set(label, []);
    for (const account of linkedAccounts) {
      const label = linkedGroupLabel(account.sourceAccount);
      const list = buckets.get(label) ?? [];
      list.push(account);
      buckets.set(label, list);
    }
    return order
      .map((label) => ({
        label,
        accounts: buckets.get(label) ?? [],
      }))
      .filter((group) => group.accounts.length > 0);
  });
  const showSetupCta = $derived(unlinkedCount > 0);
  const syncing = $derived(
    syncJob?.status === "queued" || syncJob?.status === "running",
  );
  const lastSyncLabel = $derived.by(() => {
    if (syncing) {
      return syncJob?.progress.message?.trim() || "Syncing…";
    }
    if (syncJob?.completedAt) {
      return `Last sync: ${relativeSyncTime(syncJob.completedAt)}`;
    }
    return "Last sync: Not synced yet";
  });
  const syncSeen = $derived(
    syncJob?.summary?.seen ?? syncJob?.progress.seen ?? "—",
  );
  const syncImported = $derived(
    syncJob?.summary?.imported ?? syncJob?.progress.imported ?? "—",
  );
  const syncSkipped = $derived(
    syncJob?.summary != null ? syncJob.summary.duplicates : "—",
  );
  const healthErrors = $derived(syncJob?.status === "failed" ? 1 : 0);
  const showReviewCta = $derived(
    syncJob?.status === "completed" &&
      ((syncJob.summary?.seen ?? 0) > 0 || syncJob.runIds.length > 0),
  );

  function relativeSyncTime(iso?: string) {
    if (!iso) return "Not synced yet";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "Not synced yet";
    const diffMs = Date.now() - then;
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) {
      return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    }
    return new Date(iso).toLocaleDateString();
  }

  function initialLetter(value: string) {
    return (value.trim().charAt(0) || "?").toUpperCase();
  }

  function accountAvatarClass(seed: string) {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash =
        (hash + seed.charCodeAt(i) * (i + 1)) % ACCOUNT_AVATAR_COLORS.length;
    }
    return ACCOUNT_AVATAR_COLORS[hash] ?? ACCOUNT_AVATAR_COLORS[0];
  }

  function linkedGroupLabel(sourceAccount: string) {
    if (sourceAccount.startsWith("Assets:")) return "Cash";
    if (sourceAccount.startsWith("Liabilities:")) return "Credit";
    return "Linked";
  }

  function accountTypeLabel(sourceAccount: string) {
    if (sourceAccount.startsWith("Assets:")) return "Checking";
    if (sourceAccount.startsWith("Liabilities:")) return "Credit";
    if (
      sourceAccount.startsWith("Equity:") ||
      sourceAccount.startsWith("Income:") ||
      sourceAccount.startsWith("Expenses:")
    ) {
      return "Linked";
    }
    return sourceAccount;
  }

  function institutionForLinked(account: JsonApiLinkedAccount) {
    return discoveryById.get(account.id)?.institutionName?.trim() || undefined;
  }

  function latestLedgerBalance(account: JsonApiLinkedAccount) {
    return (
      $ledgerData.accountBalance(account.sourceAccount, $conversion).at(-1)
        ?.balance ?? {}
    );
  }

  function balanceText(balance: Record<string, number>) {
    return Object.entries(balance)
      .filter(([, amount]) => Number.isFinite(amount))
      .map(([currency, amount]) => $ctx.money(amount, currency))
      .filter(Boolean)
      .join(" · ");
  }

  function accountBalanceText(account: JsonApiLinkedAccount) {
    return balanceText(latestLedgerBalance(account));
  }

  function groupBalanceText(group: LinkedGroup) {
    const total: Record<string, number> = {};
    for (const account of group.accounts) {
      for (const [currency, amount] of Object.entries(
        latestLedgerBalance(account),
      )) {
        total[currency] = (total[currency] ?? 0) + amount;
      }
    }
    return balanceText(total);
  }

  async function load() {
    if (!$snapshot || isWeb) return;
    loading = true;
    error = "";
    syncJob = null;
    try {
      const response = await ingestionJson<IngestionConfigResponse>(
        ingestionPath($snapshot.project.id),
      );
      const draft = editableIngestionConfig(response);
      loadedConfig = response;
      config = draft;
      loadedProjectId = $snapshot.project.id;
      const grouped = draft.sources.filter((source) => isGroupedSource(source));
      if (
        !selectedSourceId ||
        !grouped.some((source) => source.id === selectedSourceId)
      ) {
        selectedSourceId = grouped[0]?.id ?? "";
      }
      status = "";
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  function openSources() {
    router.push("/import/editor");
  }

  function openReviewImports() {
    if (!selectedConnection) {
      router.push("/records");
      return;
    }
    const parameters = new URLSearchParams();
    parameters.set("sourceId", selectedConnection.id);
    router.push(`/records?${parameters.toString()}`);
  }

  async function startSync(connection = selectedConnection) {
    if (!connection || !$snapshot || !canSyncConnection(connection)) return;
    error = "";
    status = "";
    try {
      const job = await beginIngestionSync({
        projectId: $snapshot.project.id,
        sourceId: connection.id,
        sourceName: connection.name || connection.id,
        onUpdate: (next) => {
          if (selectedSourceId === connection.id) {
            syncJob = next;
          }
        },
      });
      if (selectedSourceId === connection.id) {
        syncJob = job;
      }
      if (job.status === "completed") {
        status = "Sync completed.";
      } else if (job.status === "failed") {
        error = job.error?.trim() || "Sync failed.";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  function selectConnection(source: EditableIngestionSource) {
    selectedSourceId = source.id;
    discovered = [];
    selectedIds = [];
    sourceAccounts = {};
    autoDiscoveredFor = "";
    setupSheetOpen = false;
    syncJob = null;
    error = "";
    status = "";
  }

  function toggleConnection(source: EditableIngestionSource) {
    if (source.id === selectedConnection?.id) {
      connectionExpanded = !connectionExpanded;
      return;
    }
    selectConnection(source);
    connectionExpanded = true;
  }

  function connectionStatusLineFor(source: EditableIngestionSource) {
    if (source.id === selectedConnection?.id) {
      return connectionStatusLine;
    }
    const serverSource = loadedConfig?.sources.find(
      (item) => item.id === source.id,
    );
    if (serverSource?.credentialAvailable) {
      return "Credential available · Select to manage accounts";
    }
    if (isSecretConfigured(sourceSecretRef(source))) {
      return "Credential saved · Ready to discover";
    }
    return "No API key configured";
  }

  function isConnectionSyncing(source: EditableIngestionSource) {
    return source.id === selectedConnection?.id && syncing;
  }

  function canSyncConnection(source: EditableIngestionSource) {
    return (
      (source.accounts?.length ?? 0) > 0 &&
      !isWeb &&
      !saving &&
      !isConnectionSyncing(source)
    );
  }

  function syncConnection(source: EditableIngestionSource) {
    if (source.id !== selectedConnection?.id) {
      selectConnection(source);
    }
    void startSync(source);
  }

  function toggleAccount(id: string, checked: boolean) {
    if (linkedIds.has(id)) return;
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

  function openSetupSheet() {
    selectedIds = [];
    sourceAccounts = {};
    setupSheetOpen = true;
  }

  function closeSetupSheet() {
    setupSheetOpen = false;
  }

  async function discoverAccounts(options?: { quiet?: boolean }) {
    if (!selectedConnection || !$snapshot) {
      error = "Project is not ready.";
      return;
    }
    if (!canDiscover) {
      error =
        "Set a base URL and API key on the connection under Sources first.";
      return;
    }
    discovering = true;
    error = "";
    if (!options?.quiet) status = "";
    try {
      const response = await ingestionJson<{ accounts: DiscoveredAccount[] }>(
        ingestionPath($snapshot.project.id, "/discover"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sourceId: selectedConnection.id,
          }),
        },
      );
      const accounts = response.accounts ?? [];
      discovered = accounts;
      selectedIds = [];
      sourceAccounts = {};
      if (!accounts.some((account) => account.name.trim())) {
        error = "No accounts were returned for this API key.";
      } else if (!options?.quiet) {
        status = `Loaded ${accounts.length} account${accounts.length === 1 ? "" : "s"}.`;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      discovering = false;
    }
  }

  async function saveConfig(next: EditableIngestionConfig) {
    if (!$snapshot) return false;
    saving = true;
    error = "";
    try {
      await ingestionJson(ingestionPath($snapshot.project.id), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      const response = await ingestionJson<IngestionConfigResponse>(
        ingestionPath($snapshot.project.id),
      );
      loadedConfig = response;
      config = editableIngestionConfig(response);
      status = "Saved.";
      return true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      return false;
    } finally {
      saving = false;
    }
  }

  async function linkAccounts() {
    if (!config || !selectedConnection) return;
    if (!canLink) {
      error = "Map each selected account to a Beancount source account.";
      return;
    }
    const linked = selectedAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      sourceAccount: sourceAccounts[account.id]!.trim(),
      defaultCurrency: account.currency,
    }));
    const existing = selectedConnection.accounts ?? [];
    const nextAccounts = [
      ...existing,
      ...linked.filter(
        (account) => !existing.some((item) => item.id === account.id),
      ),
    ];
    const next: EditableIngestionConfig = {
      ...config,
      sources: config.sources.map((source) =>
        source.id === selectedConnection.id
          ? { ...source, accounts: nextAccounts }
          : source,
      ),
    };
    const saved = await saveConfig(next);
    if (!saved) return;
    selectedIds = [];
    sourceAccounts = {};
    setupSheetOpen = false;
  }

  async function unlinkAccount(accountId: string) {
    if (!config || !selectedConnection) return;
    if (!confirm("Remove this linked account?")) return;
    const nextAccounts = (selectedConnection.accounts ?? []).filter(
      (account) => account.id !== accountId,
    );
    const next: EditableIngestionConfig = {
      ...config,
      sources: config.sources.map((source) =>
        source.id === selectedConnection.id
          ? { ...source, accounts: nextAccounts }
          : source,
      ),
    };
    await saveConfig(next);
  }

  async function removeConnection(source: EditableIngestionSource) {
    if (!config) return;
    const sourceName = source.name || source.id;
    if (
      !confirm(
        `Remove ${sourceName}? Its linked accounts and sync configuration will be removed.`,
      )
    ) {
      return;
    }
    const next: EditableIngestionConfig = {
      ...config,
      sources: config.sources.filter((item) => item.id !== source.id),
    };
    const remainingConnections = next.sources.filter((item) =>
      isGroupedSource(item),
    );
    const saved = await saveConfig(next);
    if (!saved) return;
    if (selectedSourceId === source.id) {
      selectedSourceId = remainingConnections[0]?.id ?? "";
      discovered = [];
      selectedIds = [];
      sourceAccounts = {};
      autoDiscoveredFor = "";
      setupSheetOpen = false;
      syncJob = null;
      connectionExpanded = false;
    }
    status = `${sourceName} removed.`;
  }

  $effect(() => {
    const project = $snapshot;
    if (project && !isWeb && loadedProjectId !== project.project.id) {
      void load();
    }
  });

  $effect(() => {
    const project = $snapshot;
    const connection = selectedConnection;
    if (isWeb || !project || !connection || !config) {
      return;
    }
    const sourceId = connection.id;
    const sourceName = connection.name || connection.id;
    void restoreIngestionSyncWatch({
      projectId: project.project.id,
      sourceId,
      sourceName,
      onUpdate: (job) => {
        if (selectedSourceId === sourceId) {
          syncJob = job;
        }
      },
    }).catch((err) => {
      if (selectedSourceId === sourceId) {
        error = err instanceof Error ? err.message : String(err);
      }
    });
  });

  $effect(() => {
    if (
      isWeb ||
      !config ||
      !selectedConnection ||
      !canDiscover ||
      discovering ||
      autoDiscoveredFor === selectedConnection.id
    ) {
      return;
    }
    autoDiscoveredFor = selectedConnection.id;
    void discoverAccounts({ quiet: true });
  });

  $effect(() => {
    if (
      !setupSheetOpen ||
      discovered.length > 0 ||
      !canDiscover ||
      discovering
    ) {
      return;
    }
    void discoverAccounts({ quiet: true });
  });
</script>

<section
  class="h-full overflow-y-auto p-4 sm:p-6"
  data-ingestion-accounts-setup
>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-5">
    {#if isWeb}
      <Alert.Root>
        <FileCode2 />
        <Alert.Title>Local server required</Alert.Title>
        <Alert.Description
          >Account linking is available only through the local server.</Alert.Description
        >
      </Alert.Root>
    {:else if loading && !config}
      <AccountsPageSkeleton />
    {:else if !connections.length}
      <Empty.Root class="min-h-64 border">
        <Empty.Header>
          <Empty.Media variant="icon"><Landmark /></Empty.Media>
          <Empty.Title>No connected providers</Empty.Title>
          <Empty.Description
            >Connect a bank provider under Sources first, then return here to
            load and link bank accounts.</Empty.Description
          >
        </Empty.Header>
        <Empty.Content>
          <Button type="button" onclick={openSources}>
            Open Sources
            <Link2 class="size-4" aria-hidden="true" />
          </Button>
        </Empty.Content>
      </Empty.Root>
    {:else if selectedConnection}
      <div class="flex min-w-0 flex-col gap-6">
        {#each connections as connection (connection.id)}
          {@const isSelected = connection.id === selectedConnection.id}
          <article
            class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
          >
            <div class="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left hover:bg-muted/50"
                aria-expanded={isSelected && connectionExpanded}
                aria-label={isSelected && connectionExpanded
                  ? "Collapse connection"
                  : "Expand connection"}
                onclick={() => toggleConnection(connection)}
              >
                <ChevronDown
                  class="size-4 shrink-0 text-muted-foreground transition-transform {isSelected &&
                  connectionExpanded
                    ? ''
                    : '-rotate-90'}"
                  aria-hidden="true"
                />
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-200 text-sm font-semibold text-rose-800"
                  aria-hidden="true"
                >
                  {initialLetter(connection.name || connection.id)}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold">
                    {connection.name || connection.id}
                  </span>
                  <span
                    class="block truncate text-xs text-muted-foreground {isConnectionSyncing(
                      connection,
                    )
                      ? 'animate-pulse'
                      : ''}"
                  >
                    {connectionStatusLineFor(connection)}
                  </span>
                  {#if isSelected}
                    <span class="block truncate text-xs text-muted-foreground">
                      {lastSyncLabel}
                    </span>
                  {/if}
                </span>
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  {#snippet child({ props })}
                    <Button
                      {...props}
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="shrink-0 text-muted-foreground"
                      aria-label={`${connection.name || connection.id} actions`}
                    >
                      <MoreVertical class="size-4" aria-hidden="true" />
                    </Button>
                  {/snippet}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Group>
                    <DropdownMenu.Item
                      disabled={!canSyncConnection(connection)}
                      onSelect={() => syncConnection(connection)}
                    >
                      <RefreshCw class="size-3.5" aria-hidden="true" />
                      {isConnectionSyncing(connection) ? "Syncing…" : "Sync"}
                    </DropdownMenu.Item>
                  </DropdownMenu.Group>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Group>
                    <DropdownMenu.Item
                      class="text-destructive focus:text-destructive"
                      disabled={saving}
                      onSelect={() => void removeConnection(connection)}
                    >
                      <Trash2 class="size-3.5" aria-hidden="true" />
                      Remove connection
                    </DropdownMenu.Item>
                  </DropdownMenu.Group>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>

            {#if isSelected && connectionExpanded}
              <div class="border-t border-border px-4 pb-4 pt-3">
                {#if linkedGroups.length}
                  <div class="flex flex-col gap-4">
                    {#each linkedGroups as group (group.label)}
                      {@const groupBalance = groupBalanceText(group)}
                      <div
                        class="overflow-hidden rounded-lg border border-border bg-muted/30"
                      >
                        <div
                          class="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-3 py-2"
                        >
                          <p
                            class="text-xs font-bold uppercase tracking-wide text-muted-foreground"
                          >
                            {group.label} · {group.accounts.length}
                          </p>
                          {#if groupBalance}
                            <span
                              class="shrink-0 text-sm font-semibold tabular-nums"
                            >
                              {groupBalance}
                            </span>
                          {/if}
                        </div>
                        <ul class="divide-y divide-border" role="list">
                          {#each group.accounts as account (account.id)}
                            {@const institution = institutionForLinked(account)}
                            {@const balance = accountBalanceText(account)}
                            <li
                              class="flex items-center gap-3 bg-card/70 px-3 py-2.5"
                            >
                              <div
                                class="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold {accountAvatarClass(
                                  account.id || account.name,
                                )}"
                                aria-hidden="true"
                              >
                                {initialLetter(account.name)}
                              </div>
                              <div class="min-w-0 flex-1">
                                <p class="truncate text-sm font-medium">
                                  {account.name}{#if institution}<span
                                      class="font-normal text-muted-foreground"
                                    >
                                      • {institution}</span
                                    >{/if}
                                </p>
                                <p
                                  class="truncate text-xs text-muted-foreground"
                                >
                                  {accountTypeLabel(account.sourceAccount)}
                                </p>
                              </div>
                              {#if balance}
                                <span
                                  class="shrink-0 text-sm font-semibold tabular-nums"
                                >
                                  {balance}
                                </span>
                              {:else if account.defaultCurrency}
                                <span
                                  class="shrink-0 text-xs text-muted-foreground"
                                >
                                  {account.defaultCurrency}
                                </span>
                              {/if}
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger>
                                  {#snippet child({ props })}
                                    <Button
                                      {...props}
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      class="shrink-0 text-muted-foreground"
                                      aria-label={`${account.name} actions`}
                                    >
                                      <MoreVertical
                                        class="size-4"
                                        aria-hidden="true"
                                      />
                                    </Button>
                                  {/snippet}
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Content align="end">
                                  <DropdownMenu.Group>
                                    <DropdownMenu.Item
                                      class="text-destructive focus:text-destructive"
                                      disabled={saving}
                                      onSelect={() =>
                                        void unlinkAccount(account.id)}
                                    >
                                      <Trash2
                                        class="size-3.5"
                                        aria-hidden="true"
                                      />
                                      Unlink account
                                    </DropdownMenu.Item>
                                  </DropdownMenu.Group>
                                </DropdownMenu.Content>
                              </DropdownMenu.Root>
                            </li>
                          {/each}
                        </ul>
                      </div>
                    {/each}
                  </div>
                {:else if discovering}
                  <p class="py-2 text-sm text-muted-foreground">
                    Discovering accounts…
                  </p>
                {:else}
                  <p class="py-2 text-sm text-muted-foreground">
                    No linked accounts yet.
                  </p>
                {/if}

                <div
                  class="mt-4 overflow-hidden rounded-lg border border-border bg-secondary text-secondary-foreground"
                >
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-background/10"
                    aria-expanded={syncSummaryOpen}
                    onclick={() => (syncSummaryOpen = !syncSummaryOpen)}
                  >
                    <span class="text-sm font-semibold">Sync summary</span>
                    <span
                      class="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground"
                    >
                      {lastSyncLabel}
                    </span>
                    <ChevronDown
                      class="size-4 shrink-0 text-muted-foreground transition-transform {syncSummaryOpen
                        ? ''
                        : '-rotate-90'}"
                      aria-hidden="true"
                    />
                  </button>
                  {#if syncSummaryOpen}
                    <div
                      class="grid gap-4 border-t border-border px-3 py-3 sm:grid-cols-3"
                    >
                      <div class="flex flex-col gap-1.5">
                        <p
                          class="text-xs font-bold uppercase tracking-wide text-muted-foreground"
                        >
                          Accounts
                        </p>
                        <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                          <div>
                            <dt class="text-muted-foreground">Total</dt>
                            <dd class="font-medium">{totalAccountCount}</dd>
                          </div>
                          <div>
                            <dt class="text-muted-foreground">Linked</dt>
                            <dd class="font-medium">{linkedCount}</dd>
                          </div>
                          <div>
                            <dt class="text-muted-foreground">Unlinked</dt>
                            <dd class="font-medium">
                              {discoveryKnown ? unlinkedCount : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt class="text-muted-foreground">Institutions</dt>
                            <dd class="font-medium">{institutionCount}</dd>
                          </div>
                        </dl>
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <p
                          class="text-xs font-bold uppercase tracking-wide text-muted-foreground"
                        >
                          Transactions
                        </p>
                        <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                          <div>
                            <dt class="text-muted-foreground">Seen</dt>
                            <dd class="font-medium">{syncSeen}</dd>
                          </div>
                          <div>
                            <dt class="text-muted-foreground">Imported</dt>
                            <dd class="font-medium">{syncImported}</dd>
                          </div>
                          <div>
                            <dt class="text-muted-foreground">Updated</dt>
                            <dd class="font-medium">—</dd>
                          </div>
                          <div>
                            <dt class="text-muted-foreground">Skipped</dt>
                            <dd class="font-medium">{syncSkipped}</dd>
                          </div>
                        </dl>
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <p
                          class="text-xs font-bold uppercase tracking-wide text-muted-foreground"
                        >
                          Health
                        </p>
                        <p class="text-sm">
                          Errors:
                          <span
                            class={[
                              "font-medium",
                              healthErrors > 0
                                ? "text-red-600"
                                : "text-emerald-600",
                            ]}>{healthErrors}</span
                          >
                        </p>
                      </div>
                    </div>
                  {/if}
                </div>

                {#if showReviewCta}
                  <div
                    class="mt-4 flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-6 text-center"
                  >
                    <p class="text-sm font-semibold">
                      Transactions ready to review
                    </p>
                    <Button type="button" onclick={openReviewImports}>
                      <BookOpen class="size-4" aria-hidden="true" />
                      Review imports
                    </Button>
                  </div>
                {/if}

                {#if showSetupCta}
                  <div
                    class="mt-4 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center"
                  >
                    <div>
                      <p class="text-sm font-semibold">
                        New accounts ready to set up
                      </p>
                      <p class="mt-1 max-w-md text-sm text-muted-foreground">
                        {linkedCount} of {totalAccountCount} accounts linked. Choose
                        Beancount source accounts for newly imported accounts.
                      </p>
                    </div>
                    <Button
                      type="button"
                      class="bg-foreground text-background hover:bg-foreground/90"
                      disabled={saving || discovering}
                      onclick={openSetupSheet}
                    >
                      <Settings class="size-4" aria-hidden="true" />
                      Set Up New Accounts
                    </Button>
                  </div>
                {/if}
              </div>
            {/if}

            {#if isSelected && error}
              <div
                class="bg-destructive/10 px-3 py-2 text-destructive"
                role="alert"
              >
                <p class="text-xs font-medium">Could not load accounts</p>
                <p
                  class="mt-0.5 break-words font-mono text-[11px] leading-snug opacity-90"
                >
                  {error}
                </p>
              </div>
            {/if}
            {#if isSelected && status}
              <p
                class="border-t border-border px-4 py-3 text-sm text-muted-foreground"
                role="status"
              >
                {status}
              </p>
            {/if}
          </article>
        {/each}
      </div>
    {:else if error}
      <div
        class="rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
        role="alert"
      >
        <p class="text-xs font-medium">Could not load accounts</p>
        <p
          class="mt-0.5 break-words font-mono text-[11px] leading-snug opacity-90"
        >
          {error}
        </p>
      </div>
    {/if}
  </div>
</section>

<Sheet.Root bind:open={setupSheetOpen}>
  <Sheet.Content
    side="right"
    class="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
  >
    <Sheet.Header class="border-b px-6 py-5 pr-14">
      <Sheet.Title>Set Up New Accounts</Sheet.Title>
      <Sheet.Description>
        Select imported accounts and map each one to a Beancount source account.
      </Sheet.Description>
    </Sheet.Header>

    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      {#if discovering && discovered.length === 0}
        <p class="text-sm text-muted-foreground">Discovering accounts…</p>
      {:else if !unlinkedAccounts.length && selectableAccounts.length > 0}
        <p class="text-sm text-muted-foreground">
          All discovered accounts are already linked.
        </p>
      {:else if !unlinkedAccounts.length}
        <p class="text-sm text-muted-foreground">No accounts to set up.</p>
      {:else}
        <ul class="flex flex-col gap-2" role="list">
          {#each unlinkedAccounts as account (account.id)}
            {@const checked = selectedIds.includes(account.id)}
            <li>
              <label
                class="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  class="mt-1 size-4 shrink-0"
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
                    {[account.institutionName, account.currency, account.status]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </label>
            </li>
          {/each}
        </ul>

        {#if selectedAccounts.length}
          <div class="mt-5 flex flex-col gap-3">
            <p
              class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Map to Beancount accounts
            </p>
            <ul class="flex flex-col gap-3" role="list">
              {#each selectedAccounts as account (account.id)}
                <li
                  class="flex flex-col gap-1.5 rounded-lg border border-border p-3"
                >
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
                      onValueChange={(value) =>
                        setSourceAccount(account.id, value)}
                    />
                  </label>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      {/if}
    </div>

    <Sheet.Footer class="border-t px-6 py-4 sm:gap-2">
      <Button type="button" variant="outline" onclick={closeSetupSheet}>
        Cancel
      </Button>
      <Button
        type="button"
        disabled={!canLink || saving || discovering}
        onclick={() => void linkAccounts()}
      >
        {saving ? "Saving…" : "Link accounts"}
      </Button>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet.Root>
