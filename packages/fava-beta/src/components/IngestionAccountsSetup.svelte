<script lang="ts">
  import { accountOpenClose, type Open } from "@beancount-js/beancount";
  import type { JsonApiLinkedAccount } from "@beancount-js/beangulp";
  import type { IngestionSyncJob } from "@beancount-js/server";
  import { onDestroy } from "svelte";
  import { get } from "svelte/store";
  import { useContext } from "../context";
  import { useNavigation } from "../router/router";
  import {
    beginIngestionSync,
    restoreIngestionSyncWatch,
  } from "../studio/sync-status";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import {
    groupOtherLedgerAccounts,
    type OtherLedgerAccount,
    type OtherLedgerAccountGroup,
  } from "../ingestion/other-accounts";
  import { isSecretConfigured } from "../ingestion/secret-ref";
  import { journalRecordKey } from "../lib/journal-record-key";
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
  import { urlForAccount } from "../helpers";
  import SharedIngestionAccountsSetup, {
    type IngestionAccountsConnection,
    type IngestionAccountsLinkedAccount,
    type IngestionAccountsLinkedGroup,
    type IngestionAccountsOtherAccount,
    type IngestionAccountsOtherGroup,
    type IngestionSetupAccount,
  } from "@lapis/ui/forms/IngestionAccountsSetup.svelte";

  type DiscoveredAccount = {
    id: string;
    name: string;
    currency?: string;
    institutionName?: string;
    status?: string;
    iban?: string;
    closed?: boolean;
  };

  type LinkedGroup = {
    label: string;
    accounts: JsonApiLinkedAccount[];
  };

  type ConnectionMerchant = {
    merchantId: string;
    canonicalName: string;
    domain?: string;
    description?: string;
    logoUrl?: string;
  };

  const { snapshot, ledgerSidebarMode } = useStudioWorkspace();
  const { ledgerData, conversion } = useContext();
  const { router, activeRoute } = useNavigation();
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
  let otherAccountsOpen = $state(false);
  let openOtherAccountGroups = $state<Set<string>>(new Set());
  let syncSummaryOpen = $state(false);
  let setupSheetOpen = $state(false);
  let autoDiscoveredFor = $state("");
  let syncJob = $state<IngestionSyncJob | null>(null);
  let syncAllBusy = $state(false);
  let merchantsById = $state<Record<string, ConnectionMerchant>>({});
  let failedMerchantLogoIds = $state(new Set<string>());
  let updatingLogoFor = $state("");

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
  const otherAccountGroups = $derived(
    groupOtherLedgerAccounts($ledgerData.directives, config?.sources ?? []),
  );
  const openDirectivesByAccount = $derived(
    accountOpenClose($ledgerData.directives),
  );
  const otherAccountCount = $derived(
    otherAccountGroups.reduce(
      (count, group) => count + group.accounts.length,
      0,
    ),
  );
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
  const syncUpdated = $derived(syncJob?.summary != null ? 0 : "—");
  const healthErrors = $derived(syncJob?.status === "failed" ? 1 : 0);
  const linkedPercent = $derived(
    totalAccountCount > 0
      ? Math.round((linkedCount / totalAccountCount) * 100)
      : 0,
  );
  const syncSummaryTimeLabel = $derived.by(() => {
    if (syncing) {
      return syncJob?.progress.message?.trim() || "Syncing…";
    }
    if (syncJob?.completedAt) {
      return `Last synced ${relativeSyncTime(syncJob.completedAt)}`;
    }
    return "Not synced yet";
  });
  const showReviewCta = $derived(
    syncJob?.status === "completed" &&
      ((syncJob.summary?.seen ?? 0) > 0 || syncJob.runIds.length > 0),
  );
  const setupAccounts = $derived(
    unlinkedAccounts.map((account): IngestionSetupAccount => ({
      id: account.id,
      name: account.name,
      institutionName: account.institutionName,
      currency: account.currency,
      status: account.status,
      closed: account.closed,
    })),
  );
  const selectedSetupAccounts = $derived(
    selectedAccounts.map((account): IngestionSetupAccount => ({
      id: account.id,
      name: account.name,
      institutionName: account.institutionName,
      currency: account.currency,
      status: account.status,
      closed: account.closed,
    })),
  );
  const linkedGroupCards = $derived.by((): IngestionAccountsLinkedGroup[] =>
    linkedGroups.map((group) => ({
      label: group.label,
      balance: groupBalanceText(group) || undefined,
      accounts: group.accounts.map(linkedAccountCard),
    })),
  );
  const connectionCards = $derived.by((): IngestionAccountsConnection[] =>
    connections.map((connection) => {
      const isSelected = connection.id === selectedConnection?.id;
      const merchant = merchantFor(connection);
      return {
        id: connection.id,
        name: connection.name || connection.id,
        selected: isSelected,
        expanded: isSelected && connectionExpanded,
        statusLine: connectionStatusLineFor(connection),
        lastSyncLabel: isSelected ? lastSyncLabel : undefined,
        logoUrl:
          merchant?.logoUrl && !failedMerchantLogoIds.has(merchant.merchantId)
            ? merchant.logoUrl
            : undefined,
        logoFailed: merchant
          ? failedMerchantLogoIds.has(merchant.merchantId)
          : false,
        syncing: isConnectionSyncing(connection),
        canSync: canSyncConnection(connection),
        canUpdateLogo: canUpdateConnectionLogo(connection),
        updatingLogo: updatingLogoFor === connection.id,
        saving,
        linkedGroups: isSelected ? linkedGroupCards : [],
        linkedCount: isSelected
          ? linkedCount
          : connection.accounts?.length ?? 0,
        unlinkedCount: isSelected ? unlinkedCount : 0,
        totalAccountCount: isSelected
          ? totalAccountCount
          : connection.accounts?.length ?? 0,
        institutionCount: isSelected ? institutionCount : 0,
        discoveryKnown: isSelected ? discoveryKnown : false,
        linkedPercent: isSelected
          ? linkedPercent
          : (connection.accounts?.length ?? 0) > 0
            ? 100
            : 0,
        healthErrors: isSelected ? healthErrors : 0,
        syncSummaryOpen: isSelected && syncSummaryOpen,
        syncSummaryTimeLabel: isSelected
          ? syncSummaryTimeLabel
          : "Not synced yet",
        syncSeen: isSelected ? syncSeen : "—",
        syncUpdated: isSelected ? syncUpdated : "—",
        syncImported: isSelected ? syncImported : "—",
        syncSkipped: isSelected ? syncSkipped : "—",
        showReviewCta: isSelected && showReviewCta,
        showSetupCta: isSelected && showSetupCta,
        error: isSelected ? error : "",
        status: isSelected ? status : "",
      };
    }),
  );
  const otherAccountCards = $derived.by((): IngestionAccountsOtherGroup[] =>
    otherAccountGroups.map((group) => ({
      label: group.label,
      balance: otherGroupBalanceText(group) || undefined,
      open: openOtherAccountGroups.has(group.label),
      accounts: group.accounts.map(otherAccountCard),
    })),
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

  function accountAppearanceFor(open?: Open | null) {
    const color = open?.meta.color;
    const icon = open?.meta.icon;
    return {
      color: typeof color === "string" ? color : "",
      icon: typeof icon === "string" ? icon : "",
    };
  }

  function merchantForOpenDirective(open?: Open | null) {
    const merchantId = open?.meta.merchant_id;
    return typeof merchantId === "string"
      ? merchantsById[merchantId]
      : undefined;
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

  function latestLedgerBalance(account: string) {
    return (
      $ledgerData.accountBalance(account, $conversion).at(-1)?.balance ?? {}
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
    return balanceText(latestLedgerBalance(account.sourceAccount));
  }

  function groupBalanceText(group: LinkedGroup) {
    const total: Record<string, number> = {};
    for (const account of group.accounts) {
      for (const [currency, amount] of Object.entries(
        latestLedgerBalance(account.sourceAccount),
      )) {
        total[currency] = (total[currency] ?? 0) + amount;
      }
    }
    return balanceText(total);
  }

  function linkedAccountCard(
    account: JsonApiLinkedAccount,
  ): IngestionAccountsLinkedAccount {
    const openDirective = openDirectiveForAccount(account.sourceAccount);
    const appearance = accountAppearanceFor(openDirective);
    const merchant = merchantForOpenDirective(openDirective);
    return {
      id: account.id,
      name: account.name,
      sourceAccount: account.sourceAccount,
      href: urlForAccount(account.sourceAccount),
      institution: institutionForLinked(account),
      typeLabel: accountTypeLabel(account.sourceAccount),
      balance: accountBalanceText(account) || undefined,
      defaultCurrency: account.defaultCurrency,
      canEdit: Boolean(openDirective),
      avatar: {
        account: account.sourceAccount,
        color: appearance.color,
        icon: appearance.icon,
        merchantLogoUrl: merchant?.logoUrl,
      },
    };
  }

  function otherAccountBalanceText(account: OtherLedgerAccount) {
    return balanceText(latestLedgerBalance(account.name));
  }

  function otherGroupBalanceText(group: OtherLedgerAccountGroup) {
    const total: Record<string, number> = {};
    for (const account of group.accounts) {
      for (const [currency, amount] of Object.entries(
        latestLedgerBalance(account.name),
      )) {
        total[currency] = (total[currency] ?? 0) + amount;
      }
    }
    return balanceText(total);
  }

  function otherAccountCard(
    account: OtherLedgerAccount,
  ): IngestionAccountsOtherAccount {
    const appearance = accountAppearanceFor(account.open);
    const merchant = merchantForOpenDirective(account.open);
    return {
      name: account.name,
      href: urlForAccount(account.name),
      balance: otherAccountBalanceText(account) || undefined,
      avatar: {
        account: account.name,
        color: appearance.color,
        icon: appearance.icon,
        merchantLogoUrl: merchant?.logoUrl,
      },
    };
  }

  function openDirectiveForAccount(accountName: string) {
    return openDirectivesByAccount[accountName]?.open;
  }

  function editOpenDirective(open: Open) {
    const route = get(activeRoute);
    const params = new URLSearchParams(route.query);
    params.set("record", journalRecordKey(open));
    const search = params.toString();
    void router.updateState(search ? `?${search}` : "?");
  }

  function editLinkedAccount(account: JsonApiLinkedAccount) {
    const open = openDirectiveForAccount(account.sourceAccount);
    if (!open) {
      error = `No open directive was found for ${account.sourceAccount}.`;
      return;
    }
    editOpenDirective(open);
  }

  function editOtherAccount(account: OtherLedgerAccount) {
    editOpenDirective(account.open);
  }

  function openLedgerAccount(event: MouseEvent, account: string) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    ledgerSidebarMode.set("workspace");
    router.push(`/account/${account}`);
  }

  function merchantFor(source: EditableIngestionSource) {
    return source.merchantId ? merchantsById[source.merchantId] : undefined;
  }

  function markMerchantLogoFailed(merchantId: string) {
    failedMerchantLogoIds = new Set([...failedMerchantLogoIds, merchantId]);
  }

  async function loadMerchants(projectId: string) {
    try {
      const merchants = await ingestionJson<ConnectionMerchant[]>(
        ingestionPath(projectId, "/merchants"),
      );
      if ($snapshot?.project.id !== projectId) return;
      merchantsById = Object.fromEntries(
        merchants.map((merchant) => [merchant.merchantId, merchant]),
      );
    } catch {
      if ($snapshot?.project.id === projectId) merchantsById = {};
    }
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
      void loadMerchants($snapshot.project.id);
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
    if (!connection || !$snapshot || !canSyncConnection(connection)) {
      return false;
    }
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
        return true;
      }
      error = job.error?.trim() || "Sync failed.";
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    return false;
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

  function toggleOtherAccountGroup(label: string) {
    const next = new Set(openOtherAccountGroups);
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
    }
    openOtherAccountGroups = next;
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

  function canUpdateConnectionLogo(source: EditableIngestionSource) {
    return Boolean(sourceBaseUrl(source)?.trim()) && !isWeb && !saving;
  }

  async function updateConnectionLogo(source: EditableIngestionSource) {
    if (!$snapshot || updatingLogoFor) return;
    updatingLogoFor = source.id;
    error = "";
    status = "";
    try {
      const response = await ingestionJson<{
        source: { id: string; merchantId?: string };
        merchant: ConnectionMerchant;
      }>(
        ingestionPath(
          $snapshot.project.id,
          `/sources/${encodeURIComponent(source.id)}/merchant`,
        ),
        { method: "POST" },
      );
      config = config
        ? {
            ...config,
            sources: config.sources.map((item) =>
              item.id === source.id
                ? { ...item, merchantId: response.source.merchantId }
                : item,
            ),
          }
        : config;
      loadedConfig = loadedConfig
        ? {
            ...loadedConfig,
            sources: loadedConfig.sources.map((item) =>
              item.id === source.id
                ? { ...item, merchantId: response.source.merchantId }
                : item,
            ),
          }
        : loadedConfig;
      merchantsById = {
        ...merchantsById,
        [response.merchant.merchantId]: response.merchant,
      };
      const nextFailed = new Set(failedMerchantLogoIds);
      nextFailed.delete(response.merchant.merchantId);
      failedMerchantLogoIds = nextFailed;
      status = `Updated logo for ${source.name || source.id}.`;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      updatingLogoFor = "";
    }
  }

  async function syncAllConnections() {
    if (syncAllBusy) return;
    const syncableConnections = connections.filter((connection) =>
      canSyncConnection(connection),
    );
    if (syncableConnections.length === 0) return;

    syncAllBusy = true;
    error = "";
    status = "";
    let completed = 0;
    try {
      for (const connection of syncableConnections) {
        if (await startSync(connection)) completed += 1;
      }
      status =
        completed === syncableConnections.length
          ? "All configured connections synced."
          : `Synced ${completed} of ${syncableConnections.length} configured connections.`;
    } finally {
      syncAllBusy = false;
    }
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
    if (isWeb) return;
    ingestionHeaderActions.set({
      kind: "accounts",
      canSyncAll: connections.some((connection) =>
        canSyncConnection(connection),
      ),
      syncAllBusy,
      onSyncAll: () => void syncAllConnections(),
    });
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

  onDestroy(() => ingestionHeaderActions.set(null));
</script>

<SharedIngestionAccountsSetup
  {isWeb}
  {loading}
  pageError={error}
  connections={connectionCards}
  {otherAccountsOpen}
  {otherAccountCount}
  otherAccountGroups={otherAccountCards}
  bind:setupSheetOpen
  {discovering}
  {saving}
  unlinkedAccounts={setupAccounts}
  selectableAccountCount={selectableAccounts.length}
  {selectedIds}
  selectedAccounts={selectedSetupAccounts}
  {sourceAccounts}
  {accountItems}
  {canLink}
  onOpenSources={openSources}
  onToggleConnection={(id) => {
    const source = connections.find((connection) => connection.id === id);
    if (source) toggleConnection(source);
  }}
  onUpdateConnectionLogo={(id) => {
    const source = connections.find((connection) => connection.id === id);
    if (source) void updateConnectionLogo(source);
  }}
  onSyncConnection={(id) => {
    const source = connections.find((connection) => connection.id === id);
    if (source) syncConnection(source);
  }}
  onRemoveConnection={(id) => {
    const source = connections.find((connection) => connection.id === id);
    if (source) void removeConnection(source);
  }}
  onToggleSyncSummary={() => (syncSummaryOpen = !syncSummaryOpen)}
  onOpenReviewImports={openReviewImports}
  onOpenSetupSheet={openSetupSheet}
  onOpenLedgerAccount={openLedgerAccount}
  onEditLinkedAccount={(id) => {
    const account = linkedAccounts.find((item) => item.id === id);
    if (account) editLinkedAccount(account);
  }}
  onUnlinkAccount={(id) => void unlinkAccount(id)}
  onToggleOtherAccounts={() => (otherAccountsOpen = !otherAccountsOpen)}
  onToggleOtherAccountGroup={toggleOtherAccountGroup}
  onEditOtherAccount={(name) => {
    const account = otherAccountGroups
      .flatMap((group) => group.accounts)
      .find((item) => item.name === name);
    if (account) editOtherAccount(account);
  }}
  onToggleSetupAccount={toggleAccount}
  onSourceAccountChange={setSourceAccount}
  onCloseSetupSheet={closeSetupSheet}
  onLinkAccounts={() => void linkAccounts()}
/>
