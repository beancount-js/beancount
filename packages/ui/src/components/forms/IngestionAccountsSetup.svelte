<script lang="ts">
  import BookOpen from "lucide-svelte/icons/book-open";
  import CircleSlash from "lucide-svelte/icons/circle-slash";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import Download from "lucide-svelte/icons/download";
  import FileCode2 from "lucide-svelte/icons/file-code-2";
  import ImageUp from "lucide-svelte/icons/image-up";
  import Landmark from "lucide-svelte/icons/landmark";
  import Link2 from "lucide-svelte/icons/link-2";
  import MoreVertical from "lucide-svelte/icons/more-vertical";
  import Pencil from "lucide-svelte/icons/pencil";
  import RefreshCw from "lucide-svelte/icons/refresh-cw";
  import Settings from "lucide-svelte/icons/settings";
  import Trash2 from "lucide-svelte/icons/trash-2";
  import * as Alert from "../shadcn/alert";
  import { Badge } from "../shadcn/badge";
  import { Button } from "../shadcn/button";
  import * as DropdownMenu from "../shadcn/dropdown-menu";
  import * as Empty from "../shadcn/empty";
  import { Progress } from "../shadcn/progress";
  import { Separator } from "../shadcn/separator";
  import * as Sheet from "../shadcn/sheet";
  import AccountsPageSkeleton from "../feedback/AccountsPageSkeleton.svelte";
  import AccountAvatar from "./AccountAvatar.svelte";
  import ComboBox, { type ComboBoxOption } from "./ComboBox.svelte";
  import { accountAvatarInitial } from "./account-avatar";

  export type IngestionAccountsAvatar = {
    account: string;
    color?: string;
    icon?: string;
    merchantLogoUrl?: string;
  };

  export type IngestionAccountsLinkedAccount = {
    id: string;
    name: string;
    sourceAccount: string;
    href: string;
    institution?: string;
    typeLabel: string;
    balance?: string;
    defaultCurrency?: string;
    canEdit: boolean;
    avatar: IngestionAccountsAvatar;
  };

  export type IngestionAccountsLinkedGroup = {
    label: string;
    balance?: string;
    accounts: readonly IngestionAccountsLinkedAccount[];
  };

  export type IngestionAccountsOtherAccount = {
    name: string;
    href: string;
    balance?: string;
    avatar: IngestionAccountsAvatar;
  };

  export type IngestionAccountsOtherGroup = {
    label: string;
    balance?: string;
    open: boolean;
    accounts: readonly IngestionAccountsOtherAccount[];
  };

  export type IngestionAccountsConnection = {
    id: string;
    name: string;
    selected: boolean;
    expanded: boolean;
    statusLine: string;
    lastSyncLabel?: string;
    logoUrl?: string;
    logoAlt?: string;
    logoFailed?: boolean;
    syncing: boolean;
    canSync: boolean;
    canUpdateLogo: boolean;
    updatingLogo: boolean;
    saving: boolean;
    linkedGroups: readonly IngestionAccountsLinkedGroup[];
    linkedCount: number;
    unlinkedCount: number;
    totalAccountCount: number;
    institutionCount: number;
    discoveryKnown: boolean;
    linkedPercent: number;
    healthErrors: number;
    syncSummaryOpen: boolean;
    syncSummaryTimeLabel: string;
    syncSeen: string | number;
    syncUpdated: string | number;
    syncImported: string | number;
    syncSkipped: string | number;
    showReviewCta: boolean;
    showSetupCta: boolean;
    error?: string;
    status?: string;
  };

  export type IngestionSetupAccount = {
    id: string;
    name: string;
    institutionName?: string;
    currency?: string;
    status?: string;
    closed?: boolean;
  };

  type Props = {
    isWeb?: boolean;
    loading?: boolean;
    pageError?: string;
    connections?: readonly IngestionAccountsConnection[];
    otherAccountsOpen?: boolean;
    otherAccountCount?: number;
    otherAccountGroups?: readonly IngestionAccountsOtherGroup[];
    setupSheetOpen?: boolean;
    discovering?: boolean;
    saving?: boolean;
    unlinkedAccounts?: readonly IngestionSetupAccount[];
    selectableAccountCount?: number;
    selectedIds?: readonly string[];
    selectedAccounts?: readonly IngestionSetupAccount[];
    sourceAccounts?: Record<string, string>;
    accountItems?: readonly ComboBoxOption[];
    canLink?: boolean;
    onOpenSources?: () => void;
    onToggleConnection?: (id: string) => void;
    onUpdateConnectionLogo?: (id: string) => void;
    onSyncConnection?: (id: string) => void;
    onRemoveConnection?: (id: string) => void;
    onToggleSyncSummary?: () => void;
    onOpenReviewImports?: () => void;
    onOpenSetupSheet?: () => void;
    onOpenLedgerAccount?: (event: MouseEvent, account: string) => void;
    onEditLinkedAccount?: (id: string) => void;
    onUnlinkAccount?: (id: string) => void;
    onToggleOtherAccounts?: () => void;
    onToggleOtherAccountGroup?: (label: string) => void;
    onEditOtherAccount?: (name: string) => void;
    onToggleSetupAccount?: (id: string, checked: boolean) => void;
    onSourceAccountChange?: (id: string, value: string) => void;
    onCloseSetupSheet?: () => void;
    onLinkAccounts?: () => void;
  };

  let {
    isWeb = false,
    loading = false,
    pageError = "",
    connections = [],
    otherAccountsOpen = false,
    otherAccountCount = 0,
    otherAccountGroups = [],
    setupSheetOpen = $bindable(false),
    discovering = false,
    saving = false,
    unlinkedAccounts = [],
    selectableAccountCount = 0,
    selectedIds = [],
    selectedAccounts = [],
    sourceAccounts = {},
    accountItems = [],
    canLink = false,
    onOpenSources = () => {},
    onToggleConnection = () => {},
    onUpdateConnectionLogo = () => {},
    onSyncConnection = () => {},
    onRemoveConnection = () => {},
    onToggleSyncSummary = () => {},
    onOpenReviewImports = () => {},
    onOpenSetupSheet = () => {},
    onOpenLedgerAccount = () => {},
    onEditLinkedAccount = () => {},
    onUnlinkAccount = () => {},
    onToggleOtherAccounts = () => {},
    onToggleOtherAccountGroup = () => {},
    onEditOtherAccount = () => {},
    onToggleSetupAccount = () => {},
    onSourceAccountChange = () => {},
    onCloseSetupSheet = () => {},
    onLinkAccounts = () => {},
  }: Props = $props();

  function detailsFor(account: IngestionSetupAccount) {
    return [account.institutionName, account.currency, account.status]
      .filter(Boolean)
      .join(" · ");
  }

  function setupMappingDetails(account: IngestionSetupAccount) {
    return [account.institutionName, account.currency].filter(Boolean).join(" · ");
  }

  function fallbackInitial(label: string) {
    return accountAvatarInitial(label);
  }
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
        <Alert.Description>
          Account linking is available only through the local server.
        </Alert.Description>
      </Alert.Root>
    {:else if loading && !connections.length}
      <AccountsPageSkeleton />
    {:else if !connections.length}
      <Empty.Root class="min-h-64 border">
        <Empty.Header>
          <Empty.Media variant="icon"><Landmark /></Empty.Media>
          <Empty.Title>No connected providers</Empty.Title>
          <Empty.Description>
            Connect a bank provider under Sources first, then return here to
            load and link bank accounts.
          </Empty.Description>
        </Empty.Header>
        <Empty.Content>
          <Button type="button" onclick={onOpenSources}>
            Open Sources
            <Link2 class="size-4" aria-hidden="true" />
          </Button>
        </Empty.Content>
      </Empty.Root>
    {:else}
      <div class="flex min-w-0 flex-col gap-6">
        {#each connections as connection (connection.id)}
          <article
            class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
          >
            <div
              class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left"
                aria-expanded={connection.selected && connection.expanded}
                aria-label={connection.selected && connection.expanded
                  ? "Collapse connection"
                  : "Expand connection"}
                onclick={() => onToggleConnection(connection.id)}
              >
                <ChevronDown
                  class="size-4 shrink-0 text-muted-foreground transition-transform {connection.selected &&
                  connection.expanded
                    ? ''
                    : '-rotate-90'}"
                  aria-hidden="true"
                />
                {#if connection.logoUrl && !connection.logoFailed}
                  <span
                    class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted shadow-sm"
                    aria-hidden="true"
                  >
                    <img
                      class="size-full object-cover"
                      src={connection.logoUrl}
                      alt=""
                    />
                  </span>
                {:else}
                  <span
                    class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-200 text-sm font-semibold text-rose-800"
                    aria-hidden="true"
                  >
                    {fallbackInitial(connection.name || connection.id)}
                  </span>
                {/if}
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold">
                    {connection.name || connection.id}
                  </span>
                  <span
                    class="block truncate text-xs text-muted-foreground {connection.syncing
                      ? 'animate-pulse'
                      : ''}"
                  >
                    {connection.statusLine}
                  </span>
                  {#if connection.selected && connection.lastSyncLabel}
                    <span class="block truncate text-xs text-muted-foreground">
                      {connection.lastSyncLabel}
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
                      disabled={!connection.canUpdateLogo ||
                        connection.updatingLogo}
                      onSelect={() => onUpdateConnectionLogo(connection.id)}
                    >
                      <ImageUp class="size-3.5" aria-hidden="true" />
                      {connection.updatingLogo ? "Updating logo…" : "Update logo"}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      disabled={!connection.canSync}
                      onSelect={() => onSyncConnection(connection.id)}
                    >
                      <RefreshCw class="size-3.5" aria-hidden="true" />
                      {connection.syncing ? "Syncing…" : "Sync"}
                    </DropdownMenu.Item>
                  </DropdownMenu.Group>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Group>
                    <DropdownMenu.Item
                      class="text-destructive focus:text-destructive"
                      disabled={connection.saving}
                      onSelect={() => onRemoveConnection(connection.id)}
                    >
                      <Trash2 class="size-3.5" aria-hidden="true" />
                      Remove connection
                    </DropdownMenu.Item>
                  </DropdownMenu.Group>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>

            {#if connection.selected && connection.expanded}
              <div class="border-t border-border px-4 pb-4 pt-3">
                {#if connection.linkedGroups.length}
                  <div class="flex flex-col gap-4">
                    {#each connection.linkedGroups as group (group.label)}
                      <section class="overflow-hidden rounded-2xl bg-muted/80">
                        <div
                          class="flex items-center justify-between gap-3 px-5 py-4"
                        >
                          <p
                            class="text-sm font-semibold tracking-wide text-foreground"
                          >
                            {group.label}
                            <span class="ml-2 text-muted-foreground">
                              · {group.accounts.length}
                            </span>
                          </p>
                          {#if group.balance}
                            <span
                              class="shrink-0 text-sm font-semibold tabular-nums"
                            >
                              {group.balance}
                            </span>
                          {/if}
                        </div>
                        <ul
                          class="mx-1 mb-1 overflow-hidden rounded-xl border bg-card shadow-sm"
                          role="list"
                        >
                          {#each group.accounts as account, index (account.id)}
                            <li
                              class:rounded-b-xl={index ===
                                group.accounts.length - 1}
                              class="relative flex items-center gap-3 border-b px-[15px] py-4 transition-colors last:border-b-0 hover:bg-accent/60"
                            >
                              <a
                                href={account.href}
                                class="absolute inset-0 z-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`Open ${account.sourceAccount}`}
                                onclick={(event) =>
                                  onOpenLedgerAccount(
                                    event,
                                    account.sourceAccount,
                                  )}
                              >
                              </a>
                              <div
                                class="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-3"
                              >
                                <AccountAvatar
                                  account={account.avatar.account}
                                  color={account.avatar.color}
                                  icon={account.avatar.icon}
                                  merchantLogoUrl={account.avatar.merchantLogoUrl}
                                />
                                <span class="min-w-0 flex-1">
                                  <span
                                    class="block truncate text-sm font-medium"
                                  >
                                    {account.name}{#if account.institution}<span
                                        class="ml-2 font-normal text-muted-foreground"
                                        >•</span
                                      ><span
                                        class="ml-2 font-normal text-muted-foreground"
                                        >{account.institution}</span
                                      >{/if}
                                  </span>
                                  <span
                                    class="block truncate text-xs text-muted-foreground"
                                  >
                                    {account.typeLabel}
                                  </span>
                                </span>
                                {#if account.balance}
                                  <span
                                    class="shrink-0 text-sm font-semibold tabular-nums"
                                  >
                                    {account.balance}
                                  </span>
                                {:else if account.defaultCurrency}
                                  <span
                                    class="shrink-0 text-xs text-muted-foreground"
                                  >
                                    {account.defaultCurrency}
                                  </span>
                                {/if}
                              </div>
                              <div class="relative z-10 shrink-0">
                                <DropdownMenu.Root>
                                  <DropdownMenu.Trigger>
                                    {#snippet child({ props })}
                                      <Button
                                        {...props}
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        class="text-muted-foreground"
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
                                        disabled={!account.canEdit}
                                        onSelect={() =>
                                          onEditLinkedAccount(account.id)}
                                      >
                                        <Pencil
                                          class="size-3.5"
                                          aria-hidden="true"
                                        />
                                        Edit
                                      </DropdownMenu.Item>
                                    </DropdownMenu.Group>
                                    <DropdownMenu.Separator />
                                    <DropdownMenu.Group>
                                      <DropdownMenu.Item
                                        class="text-destructive focus:text-destructive"
                                        disabled={connection.saving}
                                        onSelect={() =>
                                          onUnlinkAccount(account.id)}
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
                              </div>
                            </li>
                          {/each}
                        </ul>
                      </section>
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
                  class="mt-4 overflow-hidden rounded-2xl border bg-secondary text-secondary-foreground"
                >
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-background/10"
                    aria-expanded={connection.syncSummaryOpen}
                    onclick={onToggleSyncSummary}
                  >
                    <span
                      class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                    >
                      <RefreshCw class="size-4" aria-hidden="true" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="flex flex-wrap items-center gap-2">
                        <span class="text-sm font-semibold">Sync summary</span>
                        <Badge
                          variant={connection.healthErrors > 0
                            ? "destructive"
                            : "secondary"}
                          class="gap-1.5"
                        >
                          <span
                            class={[
                              "size-1.5 rounded-full",
                              connection.healthErrors > 0
                                ? "bg-destructive"
                                : "bg-primary",
                            ]}
                            aria-hidden="true"
                          ></span>
                          {connection.healthErrors > 0
                            ? `${connection.healthErrors} error${connection.healthErrors === 1 ? "" : "s"}`
                            : "Healthy"}
                        </Badge>
                      </span>
                    </span>
                    <span
                      class="hidden min-w-0 truncate text-right text-xs text-muted-foreground sm:block"
                    >
                      {connection.syncSummaryTimeLabel}
                    </span>
                    <ChevronDown
                      class="size-4 shrink-0 text-muted-foreground transition-transform {connection.syncSummaryOpen
                        ? ''
                        : '-rotate-90'}"
                      aria-hidden="true"
                    />
                  </button>
                  {#if connection.syncSummaryOpen}
                    <div class="grid border-t border-border lg:grid-cols-3">
                      <section
                        class="flex flex-col gap-5 border-b border-border px-5 py-6 lg:border-b-0 lg:border-r"
                        aria-labelledby="sync-summary-accounts"
                      >
                        <div class="flex items-center gap-3">
                          <span
                            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                          >
                            <Landmark class="size-5" aria-hidden="true" />
                          </span>
                          <h3
                            id="sync-summary-accounts"
                            class="text-sm font-semibold"
                          >
                            Accounts
                          </h3>
                        </div>
                        <div class="flex items-baseline gap-2">
                          <span class="text-3xl font-semibold tabular-nums">
                            {connection.linkedCount} / {connection.totalAccountCount}
                          </span>
                          <span class="text-base text-muted-foreground">
                            linked
                          </span>
                        </div>
                        <div class="flex items-center gap-3">
                          <Progress
                            value={connection.linkedPercent}
                            aria-label={`Linked account progress for ${connection.name}`}
                            class="h-2 flex-1"
                          />
                          <span
                            class="text-xs font-medium tabular-nums text-muted-foreground"
                          >
                            {connection.linkedPercent}%
                          </span>
                        </div>
                        <dl
                          class="flex flex-col gap-3 text-xs text-muted-foreground"
                        >
                          <div class="flex items-center gap-3">
                            <dt>
                              <Link2
                                class="size-4 text-primary"
                                aria-hidden="true"
                              />
                            </dt>
                            <dd>
                              {connection.discoveryKnown
                                ? connection.unlinkedCount
                                : "—"} need linking
                            </dd>
                          </div>
                          <div class="flex items-center gap-3">
                            <dt>
                              <Landmark
                                class="size-4 text-primary"
                                aria-hidden="true"
                              />
                            </dt>
                            <dd>{connection.institutionCount} institutions</dd>
                          </div>
                        </dl>
                      </section>

                      <section
                        class="flex flex-col gap-5 border-b border-border px-5 py-6 lg:border-b-0 lg:border-r"
                        aria-labelledby="sync-summary-transactions"
                      >
                        <div class="flex items-center gap-3">
                          <span
                            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                          >
                            <RefreshCw class="size-5" aria-hidden="true" />
                          </span>
                          <h3
                            id="sync-summary-transactions"
                            class="text-sm font-semibold"
                          >
                            Transactions
                          </h3>
                        </div>
                        <div class="flex items-baseline gap-2">
                          <span class="text-3xl font-semibold tabular-nums">
                            {connection.syncSeen}
                          </span>
                          <span class="text-base text-muted-foreground">
                            seen
                          </span>
                        </div>
                        <Separator />
                        <div
                          class="flex items-center gap-3 text-muted-foreground"
                        >
                          <span
                            class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                          >
                            <RefreshCw class="size-4" aria-hidden="true" />
                          </span>
                          <span class="text-xs">
                            <span
                              class="font-medium tabular-nums text-foreground"
                            >
                              {connection.syncUpdated}
                            </span>
                            updated
                          </span>
                        </div>
                      </section>

                      <section
                        class="flex flex-col gap-5 px-5 py-6"
                        aria-labelledby="sync-summary-import"
                      >
                        <div class="flex items-center gap-3">
                          <span
                            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                          >
                            <Download class="size-5" aria-hidden="true" />
                          </span>
                          <h3
                            id="sync-summary-import"
                            class="text-sm font-semibold"
                          >
                            Import
                          </h3>
                        </div>
                        <div class="flex items-baseline gap-2">
                          <span class="text-3xl font-semibold tabular-nums">
                            {connection.syncImported}
                          </span>
                          <span class="text-base text-muted-foreground">
                            imported
                          </span>
                        </div>
                        <Separator />
                        <div
                          class="flex items-center gap-3 text-muted-foreground"
                        >
                          <span
                            class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                          >
                            <CircleSlash class="size-4" aria-hidden="true" />
                          </span>
                          <span class="text-xs">
                            <span
                              class="font-medium tabular-nums text-foreground"
                            >
                              {connection.syncSkipped}
                            </span>
                            skipped
                          </span>
                        </div>
                      </section>
                    </div>
                  {/if}
                </div>

                {#if connection.showReviewCta}
                  <div
                    class="mt-4 flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-6 text-center"
                  >
                    <p class="text-sm font-semibold">
                      Transactions ready to review
                    </p>
                    <Button type="button" onclick={onOpenReviewImports}>
                      <BookOpen class="size-4" aria-hidden="true" />
                      Review imports
                    </Button>
                  </div>
                {/if}

                {#if connection.showSetupCta}
                  <div
                    class="mt-4 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center"
                  >
                    <div>
                      <p class="text-sm font-semibold">
                        New accounts ready to set up
                      </p>
                      <p class="mt-1 max-w-md text-sm text-muted-foreground">
                        {connection.linkedCount} of {connection.totalAccountCount}
                        accounts linked. Choose Beancount source accounts for
                        newly imported accounts.
                      </p>
                    </div>
                    <Button
                      type="button"
                      class="bg-foreground text-background hover:bg-foreground/90"
                      disabled={saving || discovering}
                      onclick={onOpenSetupSheet}
                    >
                      <Settings class="size-4" aria-hidden="true" />
                      Set Up New Accounts
                    </Button>
                  </div>
                {/if}
              </div>
            {/if}

            {#if connection.selected && connection.error}
              <div
                class="bg-destructive/10 px-3 py-2 text-destructive"
                role="alert"
              >
                <p class="text-xs font-medium">Could not load accounts</p>
                <p
                  class="mt-0.5 break-words font-mono text-[11px] leading-snug opacity-90"
                >
                  {connection.error}
                </p>
              </div>
            {/if}
            {#if connection.selected && connection.status}
              <p
                class="border-t border-border px-4 py-3 text-sm text-muted-foreground"
                role="status"
              >
                {connection.status}
              </p>
            {/if}
          </article>
        {/each}

        <section
          class="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
          aria-labelledby="other-ledger-accounts"
        >
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            aria-expanded={otherAccountsOpen}
            aria-controls="other-ledger-account-groups"
            onclick={onToggleOtherAccounts}
          >
            <ChevronDown
              class="size-4 shrink-0 text-muted-foreground transition-transform {otherAccountsOpen
                ? ''
                : '-rotate-90'}"
              aria-hidden="true"
            />
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              aria-hidden="true"
            >
              <Landmark class="size-4" />
            </span>
            <span class="min-w-0 flex-1">
              <span
                id="other-ledger-accounts"
                class="block text-sm font-semibold"
              >
                Other Accounts
              </span>
              <span class="block text-xs text-muted-foreground">
                Ledger accounts not assigned to a sync configuration
              </span>
            </span>
            <Badge variant="secondary" class="shrink-0 tabular-nums">
              {otherAccountCount}
            </Badge>
          </button>

          {#if otherAccountsOpen && otherAccountGroups.length}
            <div
              id="other-ledger-account-groups"
              class="border-t border-border px-4 pb-4 pt-3"
            >
              <div class="flex flex-col gap-4">
                {#each otherAccountGroups as group (group.label)}
                  <section class="overflow-hidden rounded-2xl bg-muted/80">
                    <button
                      type="button"
                      class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-background/30"
                      aria-expanded={group.open}
                      aria-controls={`other-account-group-${group.label}`}
                      onclick={() => onToggleOtherAccountGroup(group.label)}
                    >
                      <span
                        class="text-sm font-semibold tracking-wide text-foreground"
                      >
                        {group.label}
                        <span class="ml-2 text-muted-foreground">
                          · {group.accounts.length}
                        </span>
                      </span>
                      <span class="flex shrink-0 items-center gap-3">
                        {#if group.balance}
                          <span class="text-sm font-semibold tabular-nums">
                            {group.balance}
                          </span>
                        {/if}
                        <ChevronDown
                          class="size-4 text-muted-foreground transition-transform {group.open
                            ? ''
                            : '-rotate-90'}"
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                    {#if group.open}
                      <ul
                        id={`other-account-group-${group.label}`}
                        class="mx-1 mb-1 overflow-hidden rounded-xl border bg-card shadow-sm"
                        role="list"
                      >
                        {#each group.accounts as account, index (account.name)}
                          <li
                            class:rounded-b-xl={index ===
                              group.accounts.length - 1}
                            class="relative flex items-center gap-3 border-b px-[15px] py-4 transition-colors last:border-b-0 hover:bg-accent/60"
                          >
                            <a
                              href={account.href}
                              class="absolute inset-0 z-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Open ${account.name}`}
                              onclick={(event) =>
                                onOpenLedgerAccount(event, account.name)}
                            >
                            </a>
                            <div
                              class="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-3"
                            >
                              <AccountAvatar
                                account={account.avatar.account}
                                color={account.avatar.color}
                                icon={account.avatar.icon}
                                merchantLogoUrl={account.avatar.merchantLogoUrl}
                              />
                              <span class="min-w-0 flex-1">
                                <span
                                  class="block truncate text-sm font-medium"
                                >
                                  {account.name}
                                </span>
                                <span
                                  class="block truncate text-xs text-muted-foreground"
                                >
                                  Open directive
                                </span>
                              </span>
                              {#if account.balance}
                                <span
                                  class="shrink-0 text-sm font-semibold tabular-nums"
                                >
                                  {account.balance}
                                </span>
                              {/if}
                            </div>
                            <div class="relative z-10 shrink-0">
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger>
                                  {#snippet child({ props })}
                                    <Button
                                      {...props}
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      class="text-muted-foreground"
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
                                      onSelect={() =>
                                        onEditOtherAccount(account.name)}
                                    >
                                      <Pencil
                                        class="size-3.5"
                                        aria-hidden="true"
                                      />
                                      Edit
                                    </DropdownMenu.Item>
                                  </DropdownMenu.Group>
                                </DropdownMenu.Content>
                              </DropdownMenu.Root>
                            </div>
                          </li>
                        {/each}
                      </ul>
                    {/if}
                  </section>
                {/each}
              </div>
            </div>
          {:else if otherAccountsOpen}
            <p
              class="border-t border-border px-4 py-3 text-sm text-muted-foreground"
            >
              All open ledger accounts are assigned to a sync configuration.
            </p>
          {/if}
        </section>
      </div>
    {/if}

    {#if pageError && !connections.some((connection) => connection.selected)}
      <div
        class="rounded-lg bg-destructive/10 px-3 py-2 text-destructive"
        role="alert"
      >
        <p class="text-xs font-medium">Could not load accounts</p>
        <p
          class="mt-0.5 break-words font-mono text-[11px] leading-snug opacity-90"
        >
          {pageError}
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
      {#if discovering && unlinkedAccounts.length === 0}
        <p class="text-sm text-muted-foreground">Discovering accounts…</p>
      {:else if !unlinkedAccounts.length && selectableAccountCount > 0}
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
                    onToggleSetupAccount(
                      account.id,
                      event.currentTarget.checked,
                    )}
                />
                <span class="min-w-0 flex-1">
                  <span
                    class="flex flex-wrap items-center gap-2 text-sm font-medium"
                  >
                    <span>{account.name}</span>
                    {#if account.closed}
                      <Badge variant="outline" class="shrink-0">Closed</Badge>
                    {/if}
                  </span>
                  <span class="mt-0.5 block text-xs text-muted-foreground">
                    {detailsFor(account)}
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
                    <div
                      class="flex flex-wrap items-center gap-2 text-sm font-medium"
                    >
                      <span>{account.name}</span>
                      {#if account.closed}
                        <Badge variant="outline" class="shrink-0">Closed</Badge>
                      {/if}
                    </div>
                    <p class="text-xs text-muted-foreground">
                      {setupMappingDetails(account)}
                    </p>
                  </div>
                  <label class="flex flex-col gap-1">
                    <span class="text-xs font-medium text-muted-foreground">
                      Source account
                    </span>
                    <ComboBox
                      items={accountItems}
                      value={sourceAccounts[account.id] ?? ""}
                      placeholder="Select account"
                      onValueChange={(value) =>
                        onSourceAccountChange(account.id, value)}
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
      <Button type="button" variant="outline" onclick={onCloseSetupSheet}>
        Cancel
      </Button>
      <Button
        type="button"
        disabled={!canLink || saving || discovering}
        onclick={onLinkAccounts}
      >
        {saving ? "Saving…" : "Link accounts"}
      </Button>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet.Root>
