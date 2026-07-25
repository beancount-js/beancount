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
    return [account.institutionName, account.currency]
      .filter(Boolean)
      .join(" · ");
  }

  function fallbackInitial(label: string) {
    return accountAvatarInitial(label);
  }
</script>

<section
  class="cn-forms-ingestionaccountssetup-204-1"
  data-ingestion-accounts-setup
>
  <div class="cn-forms-ingestionaccountssetup-207-1">
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
      <Empty.Root class="cn-forms-ingestionaccountssetup-219-1">
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
            <Link2
              class="cn-forms-ingestionaccountssetup-231-1"
              aria-hidden="true"
            />
          </Button>
        </Empty.Content>
      </Empty.Root>
    {:else}
      <div class="cn-forms-ingestionaccountssetup-236-1">
        {#each connections as connection (connection.id)}
          <article class="cn-forms-ingestionaccountssetup-239-1">
            <div class="cn-forms-ingestionaccountssetup-242-1">
              <button
                type="button"
                class="cn-forms-ingestionaccountssetup-246-1"
                aria-expanded={connection.selected && connection.expanded}
                aria-label={connection.selected && connection.expanded
                  ? "Collapse connection"
                  : "Expand connection"}
                onclick={() => onToggleConnection(connection.id)}
              >
                <ChevronDown
                  class="cn-forms-ingestionaccountssetup-254-2 cn-forms-ingestionaccountssetup-254-1 cn-forms-ingestionaccountssetup-254-3 cn-forms-ingestionaccountssetup-254-4 {connection.selected &&
                  connection.expanded
                    ? ''
                    : '-rotate-90'}"
                  aria-hidden="true"
                />
                {#if connection.logoUrl && !connection.logoFailed}
                  <span
                    class="cn-forms-ingestionaccountssetup-262-1"
                    aria-hidden="true"
                  >
                    <img
                      class="cn-forms-ingestionaccountssetup-266-1"
                      src={connection.logoUrl}
                      alt=""
                    />
                  </span>
                {:else}
                  <span
                    class="cn-forms-ingestionaccountssetup-273-1"
                    aria-hidden="true"
                  >
                    {fallbackInitial(connection.name || connection.id)}
                  </span>
                {/if}
                <span class="cn-forms-ingestionaccountssetup-279-1">
                  <span class="cn-forms-ingestionaccountssetup-280-1">
                    {connection.name || connection.id}
                  </span>
                  <span
                    class="cn-forms-ingestionaccountssetup-284-1 cn-forms-ingestionaccountssetup-284-4 cn-forms-ingestionaccountssetup-284-3 cn-forms-ingestionaccountssetup-284-2 {connection.syncing
                      ? 'animate-pulse'
                      : ''}"
                  >
                    {connection.statusLine}
                  </span>
                  {#if connection.selected && connection.lastSyncLabel}
                    <span class="cn-forms-ingestionaccountssetup-291-1">
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
                      class="cn-forms-ingestionaccountssetup-305-1"
                      aria-label={`${connection.name || connection.id} actions`}
                    >
                      <MoreVertical
                        class="cn-forms-ingestionaccountssetup-308-1"
                        aria-hidden="true"
                      />
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
                      <ImageUp
                        class="cn-forms-ingestionaccountssetup-319-1"
                        aria-hidden="true"
                      />
                      {connection.updatingLogo
                        ? "Updating logo…"
                        : "Update logo"}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      disabled={!connection.canSync}
                      onSelect={() => onSyncConnection(connection.id)}
                    >
                      <RefreshCw
                        class="cn-forms-ingestionaccountssetup-326-1"
                        aria-hidden="true"
                      />
                      {connection.syncing ? "Syncing…" : "Sync"}
                    </DropdownMenu.Item>
                  </DropdownMenu.Group>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Group>
                    <DropdownMenu.Item
                      class="cn-forms-ingestionaccountssetup-333-1"
                      disabled={connection.saving}
                      onSelect={() => onRemoveConnection(connection.id)}
                    >
                      <Trash2
                        class="cn-forms-ingestionaccountssetup-337-1"
                        aria-hidden="true"
                      />
                      Remove connection
                    </DropdownMenu.Item>
                  </DropdownMenu.Group>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>

            {#if connection.selected && connection.expanded}
              <div class="cn-forms-ingestionaccountssetup-346-1">
                {#if connection.linkedGroups.length}
                  <div class="cn-forms-ingestionaccountssetup-348-1">
                    {#each connection.linkedGroups as group (group.label)}
                      <section class="cn-forms-ingestionaccountssetup-350-1">
                        <div class="cn-forms-ingestionaccountssetup-352-1">
                          <p class="cn-forms-ingestionaccountssetup-355-1">
                            {group.label}
                            <span class="cn-forms-ingestionaccountssetup-358-1">
                              · {group.accounts.length}
                            </span>
                          </p>
                          {#if group.balance}
                            <span class="cn-forms-ingestionaccountssetup-364-1">
                              {group.balance}
                            </span>
                          {/if}
                        </div>
                        <ul
                          class="cn-forms-ingestionaccountssetup-371-1"
                          role="list"
                        >
                          {#each group.accounts as account, index (account.id)}
                            <li
                              class:cn-forms-ingestionaccountssetup-376-1={index ===
                                group.accounts.length - 1}
                              class="cn-forms-ingestionaccountssetup-378-1"
                            >
                              <a
                                href={account.href}
                                class="cn-forms-ingestionaccountssetup-382-1"
                                aria-label={`Open ${account.sourceAccount}`}
                                onclick={(event) =>
                                  onOpenLedgerAccount(
                                    event,
                                    account.sourceAccount,
                                  )}
                              >
                              </a>
                              <div
                                class="cn-forms-ingestionaccountssetup-392-1"
                              >
                                <AccountAvatar
                                  account={account.avatar.account}
                                  color={account.avatar.color}
                                  icon={account.avatar.icon}
                                  merchantLogoUrl={account.avatar
                                    .merchantLogoUrl}
                                />
                                <span
                                  class="cn-forms-ingestionaccountssetup-400-1"
                                >
                                  <span
                                    class="cn-forms-ingestionaccountssetup-402-1"
                                  >
                                    {account.name}{#if account.institution}<span
                                        class="cn-forms-ingestionaccountssetup-405-1"
                                        >•</span
                                      ><span
                                        class="cn-forms-ingestionaccountssetup-408-1"
                                        >{account.institution}</span
                                      >{/if}
                                  </span>
                                  <span
                                    class="cn-forms-ingestionaccountssetup-413-1"
                                  >
                                    {account.typeLabel}
                                  </span>
                                </span>
                                {#if account.balance}
                                  <span
                                    class="cn-forms-ingestionaccountssetup-420-1"
                                  >
                                    {account.balance}
                                  </span>
                                {:else if account.defaultCurrency}
                                  <span
                                    class="cn-forms-ingestionaccountssetup-426-1"
                                  >
                                    {account.defaultCurrency}
                                  </span>
                                {/if}
                              </div>
                              <div
                                class="cn-forms-ingestionaccountssetup-432-1"
                              >
                                <DropdownMenu.Root>
                                  <DropdownMenu.Trigger>
                                    {#snippet child({ props })}
                                      <Button
                                        {...props}
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        class="cn-forms-ingestionaccountssetup-441-1"
                                        aria-label={`${account.name} actions`}
                                      >
                                        <MoreVertical
                                          class="cn-forms-ingestionaccountssetup-445-1"
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
                                          class="cn-forms-ingestionaccountssetup-459-1"
                                          aria-hidden="true"
                                        />
                                        Edit
                                      </DropdownMenu.Item>
                                    </DropdownMenu.Group>
                                    <DropdownMenu.Separator />
                                    <DropdownMenu.Group>
                                      <DropdownMenu.Item
                                        class="cn-forms-ingestionaccountssetup-468-1"
                                        disabled={connection.saving}
                                        onSelect={() =>
                                          onUnlinkAccount(account.id)}
                                      >
                                        <Trash2
                                          class="cn-forms-ingestionaccountssetup-474-1"
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
                  <p class="cn-forms-ingestionaccountssetup-490-1">
                    Discovering accounts…
                  </p>
                {:else}
                  <p class="cn-forms-ingestionaccountssetup-494-1">
                    No linked accounts yet.
                  </p>
                {/if}

                <div class="cn-forms-ingestionaccountssetup-500-1">
                  <button
                    type="button"
                    class="cn-forms-ingestionaccountssetup-504-1"
                    aria-expanded={connection.syncSummaryOpen}
                    onclick={onToggleSyncSummary}
                  >
                    <span class="cn-forms-ingestionaccountssetup-509-1">
                      <RefreshCw
                        class="cn-forms-ingestionaccountssetup-511-1"
                        aria-hidden="true"
                      />
                    </span>
                    <span class="cn-forms-ingestionaccountssetup-513-1">
                      <span class="cn-forms-ingestionaccountssetup-514-1">
                        <span class="cn-forms-ingestionaccountssetup-515-1"
                          >Sync summary</span
                        >
                        <Badge
                          variant={connection.healthErrors > 0
                            ? "destructive"
                            : "secondary"}
                          class="cn-forms-ingestionaccountssetup-520-1"
                        >
                          <span
                            class={[
                              "cn-forms-ingestionaccountssetup-524-1",
                              connection.healthErrors > 0
                                ? "cn-forms-ingestionaccountssetup-526-1"
                                : "cn-forms-ingestionaccountssetup-527-1",
                            ]}
                            aria-hidden="true"
                          ></span>
                          {connection.healthErrors > 0
                            ? `${connection.healthErrors} error${connection.healthErrors === 1 ? "" : "s"}`
                            : "Healthy"}
                        </Badge>
                      </span>
                    </span>
                    <span class="cn-forms-ingestionaccountssetup-538-1">
                      {connection.syncSummaryTimeLabel}
                    </span>
                    <ChevronDown
                      class="cn-forms-ingestionaccountssetup-543-2 cn-forms-ingestionaccountssetup-543-1 cn-forms-ingestionaccountssetup-543-3 cn-forms-ingestionaccountssetup-543-4 {connection.syncSummaryOpen
                        ? ''
                        : '-rotate-90'}"
                      aria-hidden="true"
                    />
                  </button>
                  {#if connection.syncSummaryOpen}
                    <div class="cn-forms-ingestionaccountssetup-550-1">
                      <section
                        class="cn-forms-ingestionaccountssetup-552-1"
                        aria-labelledby="sync-summary-accounts"
                      >
                        <div class="cn-forms-ingestionaccountssetup-555-1">
                          <span class="cn-forms-ingestionaccountssetup-557-1">
                            <Landmark
                              class="cn-forms-ingestionaccountssetup-559-1"
                              aria-hidden="true"
                            />
                          </span>
                          <h3
                            id="sync-summary-accounts"
                            class="cn-forms-ingestionaccountssetup-563-1"
                          >
                            Accounts
                          </h3>
                        </div>
                        <div class="cn-forms-ingestionaccountssetup-568-1">
                          <span class="cn-forms-ingestionaccountssetup-569-1">
                            {connection.linkedCount} / {connection.totalAccountCount}
                          </span>
                          <span class="cn-forms-ingestionaccountssetup-572-1">
                            linked
                          </span>
                        </div>
                        <div class="cn-forms-ingestionaccountssetup-576-1">
                          <Progress
                            value={connection.linkedPercent}
                            aria-label={`Linked account progress for ${connection.name}`}
                            class="cn-forms-ingestionaccountssetup-580-1"
                          />
                          <span class="cn-forms-ingestionaccountssetup-583-1">
                            {connection.linkedPercent}%
                          </span>
                        </div>
                        <dl class="cn-forms-ingestionaccountssetup-589-1">
                          <div class="cn-forms-ingestionaccountssetup-591-1">
                            <dt>
                              <Link2
                                class="cn-forms-ingestionaccountssetup-594-1"
                                aria-hidden="true"
                              />
                            </dt>
                            <dd>
                              {connection.discoveryKnown
                                ? connection.unlinkedCount
                                : "—"} need linking
                            </dd>
                          </div>
                          <div class="cn-forms-ingestionaccountssetup-604-1">
                            <dt>
                              <Landmark
                                class="cn-forms-ingestionaccountssetup-607-1"
                                aria-hidden="true"
                              />
                            </dt>
                            <dd>{connection.institutionCount} institutions</dd>
                          </div>
                        </dl>
                      </section>

                      <section
                        class="cn-forms-ingestionaccountssetup-617-1"
                        aria-labelledby="sync-summary-transactions"
                      >
                        <div class="cn-forms-ingestionaccountssetup-620-1">
                          <span class="cn-forms-ingestionaccountssetup-622-1">
                            <RefreshCw
                              class="cn-forms-ingestionaccountssetup-624-1"
                              aria-hidden="true"
                            />
                          </span>
                          <h3
                            id="sync-summary-transactions"
                            class="cn-forms-ingestionaccountssetup-628-1"
                          >
                            Transactions
                          </h3>
                        </div>
                        <div class="cn-forms-ingestionaccountssetup-633-1">
                          <span class="cn-forms-ingestionaccountssetup-634-1">
                            {connection.syncSeen}
                          </span>
                          <span class="cn-forms-ingestionaccountssetup-637-1">
                            seen
                          </span>
                        </div>
                        <Separator />
                        <div class="cn-forms-ingestionaccountssetup-643-1">
                          <span class="cn-forms-ingestionaccountssetup-646-1">
                            <RefreshCw
                              class="cn-forms-ingestionaccountssetup-648-1"
                              aria-hidden="true"
                            />
                          </span>
                          <span class="cn-forms-ingestionaccountssetup-650-1">
                            <span class="cn-forms-ingestionaccountssetup-652-1">
                              {connection.syncUpdated}
                            </span>
                            updated
                          </span>
                        </div>
                      </section>

                      <section
                        class="cn-forms-ingestionaccountssetup-662-1"
                        aria-labelledby="sync-summary-import"
                      >
                        <div class="cn-forms-ingestionaccountssetup-665-1">
                          <span class="cn-forms-ingestionaccountssetup-667-1">
                            <Download
                              class="cn-forms-ingestionaccountssetup-669-1"
                              aria-hidden="true"
                            />
                          </span>
                          <h3
                            id="sync-summary-import"
                            class="cn-forms-ingestionaccountssetup-673-1"
                          >
                            Import
                          </h3>
                        </div>
                        <div class="cn-forms-ingestionaccountssetup-678-1">
                          <span class="cn-forms-ingestionaccountssetup-679-1">
                            {connection.syncImported}
                          </span>
                          <span class="cn-forms-ingestionaccountssetup-682-1">
                            imported
                          </span>
                        </div>
                        <Separator />
                        <div class="cn-forms-ingestionaccountssetup-688-1">
                          <span class="cn-forms-ingestionaccountssetup-691-1">
                            <CircleSlash
                              class="cn-forms-ingestionaccountssetup-693-1"
                              aria-hidden="true"
                            />
                          </span>
                          <span class="cn-forms-ingestionaccountssetup-695-1">
                            <span class="cn-forms-ingestionaccountssetup-697-1">
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
                  <div class="cn-forms-ingestionaccountssetup-711-1">
                    <p class="cn-forms-ingestionaccountssetup-713-1">
                      Transactions ready to review
                    </p>
                    <Button type="button" onclick={onOpenReviewImports}>
                      <BookOpen
                        class="cn-forms-ingestionaccountssetup-717-1"
                        aria-hidden="true"
                      />
                      Review imports
                    </Button>
                  </div>
                {/if}

                {#if connection.showSetupCta}
                  <div class="cn-forms-ingestionaccountssetup-725-1">
                    <div>
                      <p class="cn-forms-ingestionaccountssetup-728-1">
                        New accounts ready to set up
                      </p>
                      <p class="cn-forms-ingestionaccountssetup-731-1">
                        {connection.linkedCount} of {connection.totalAccountCount}
                        accounts linked. Choose Beancount source accounts for newly
                        imported accounts.
                      </p>
                    </div>
                    <Button
                      type="button"
                      class="cn-forms-ingestionaccountssetup-739-1"
                      disabled={saving || discovering}
                      onclick={onOpenSetupSheet}
                    >
                      <Settings
                        class="cn-forms-ingestionaccountssetup-743-1"
                        aria-hidden="true"
                      />
                      Set Up New Accounts
                    </Button>
                  </div>
                {/if}
              </div>
            {/if}

            {#if connection.selected && connection.error}
              <div class="cn-forms-ingestionaccountssetup-753-1" role="alert">
                <p class="cn-forms-ingestionaccountssetup-756-1">
                  Could not load accounts
                </p>
                <p class="cn-forms-ingestionaccountssetup-758-1">
                  {connection.error}
                </p>
              </div>
            {/if}
            {#if connection.selected && connection.status}
              <p class="cn-forms-ingestionaccountssetup-766-1" role="status">
                {connection.status}
              </p>
            {/if}
          </article>
        {/each}

        <section
          class="cn-forms-ingestionaccountssetup-776-1"
          aria-labelledby="other-ledger-accounts"
        >
          <button
            type="button"
            class="cn-forms-ingestionaccountssetup-781-1"
            aria-expanded={otherAccountsOpen}
            aria-controls="other-ledger-account-groups"
            onclick={onToggleOtherAccounts}
          >
            <ChevronDown
              class="cn-forms-ingestionaccountssetup-787-2 cn-forms-ingestionaccountssetup-787-1 cn-forms-ingestionaccountssetup-787-3 cn-forms-ingestionaccountssetup-787-4 {otherAccountsOpen
                ? ''
                : '-rotate-90'}"
              aria-hidden="true"
            />
            <span
              class="cn-forms-ingestionaccountssetup-793-1"
              aria-hidden="true"
            >
              <Landmark class="cn-forms-ingestionaccountssetup-796-1" />
            </span>
            <span class="cn-forms-ingestionaccountssetup-798-1">
              <span
                id="other-ledger-accounts"
                class="cn-forms-ingestionaccountssetup-801-1"
              >
                Other Accounts
              </span>
              <span class="cn-forms-ingestionaccountssetup-805-1">
                Ledger accounts not assigned to a sync configuration
              </span>
            </span>
            <Badge
              variant="secondary"
              class="cn-forms-ingestionaccountssetup-809-1"
            >
              {otherAccountCount}
            </Badge>
          </button>

          {#if otherAccountsOpen && otherAccountGroups.length}
            <div
              id="other-ledger-account-groups"
              class="cn-forms-ingestionaccountssetup-817-1"
            >
              <div class="cn-forms-ingestionaccountssetup-819-1">
                {#each otherAccountGroups as group (group.label)}
                  <section class="cn-forms-ingestionaccountssetup-821-1">
                    <button
                      type="button"
                      class="cn-forms-ingestionaccountssetup-824-1"
                      aria-expanded={group.open}
                      aria-controls={`other-account-group-${group.label}`}
                      onclick={() => onToggleOtherAccountGroup(group.label)}
                    >
                      <span class="cn-forms-ingestionaccountssetup-830-1">
                        {group.label}
                        <span class="cn-forms-ingestionaccountssetup-833-1">
                          · {group.accounts.length}
                        </span>
                      </span>
                      <span class="cn-forms-ingestionaccountssetup-837-1">
                        {#if group.balance}
                          <span class="cn-forms-ingestionaccountssetup-839-1">
                            {group.balance}
                          </span>
                        {/if}
                        <ChevronDown
                          class="cn-forms-ingestionaccountssetup-844-1 cn-forms-ingestionaccountssetup-844-2 cn-forms-ingestionaccountssetup-844-3 {group.open
                            ? ''
                            : '-rotate-90'}"
                          aria-hidden="true"
                        />
                      </span>
                    </button>
                    {#if group.open}
                      <ul
                        id={`other-account-group-${group.label}`}
                        class="cn-forms-ingestionaccountssetup-854-1"
                        role="list"
                      >
                        {#each group.accounts as account, index (account.name)}
                          <li
                            class:cn-forms-ingestionaccountssetup-859-1={index ===
                              group.accounts.length - 1}
                            class="cn-forms-ingestionaccountssetup-861-1"
                          >
                            <a
                              href={account.href}
                              class="cn-forms-ingestionaccountssetup-865-1"
                              aria-label={`Open ${account.name}`}
                              onclick={(event) =>
                                onOpenLedgerAccount(event, account.name)}
                            >
                            </a>
                            <div class="cn-forms-ingestionaccountssetup-872-1">
                              <AccountAvatar
                                account={account.avatar.account}
                                color={account.avatar.color}
                                icon={account.avatar.icon}
                                merchantLogoUrl={account.avatar.merchantLogoUrl}
                              />
                              <span
                                class="cn-forms-ingestionaccountssetup-880-1"
                              >
                                <span
                                  class="cn-forms-ingestionaccountssetup-882-1"
                                >
                                  {account.name}
                                </span>
                                <span
                                  class="cn-forms-ingestionaccountssetup-887-1"
                                >
                                  Open directive
                                </span>
                              </span>
                              {#if account.balance}
                                <span
                                  class="cn-forms-ingestionaccountssetup-894-1"
                                >
                                  {account.balance}
                                </span>
                              {/if}
                            </div>
                            <div class="cn-forms-ingestionaccountssetup-900-1">
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger>
                                  {#snippet child({ props })}
                                    <Button
                                      {...props}
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      class="cn-forms-ingestionaccountssetup-909-1"
                                      aria-label={`${account.name} actions`}
                                    >
                                      <MoreVertical
                                        class="cn-forms-ingestionaccountssetup-913-1"
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
                                        class="cn-forms-ingestionaccountssetup-926-1"
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
            <p class="cn-forms-ingestionaccountssetup-945-1">
              All open ledger accounts are assigned to a sync configuration.
            </p>
          {/if}
        </section>
      </div>
    {/if}

    {#if pageError && !connections.some((connection) => connection.selected)}
      <div class="cn-forms-ingestionaccountssetup-956-1" role="alert">
        <p class="cn-forms-ingestionaccountssetup-959-1">
          Could not load accounts
        </p>
        <p class="cn-forms-ingestionaccountssetup-961-1">
          {pageError}
        </p>
      </div>
    {/if}
  </div>
</section>

<Sheet.Root bind:open={setupSheetOpen}>
  <Sheet.Content side="right" class="cn-forms-ingestionaccountssetup-973-1">
    <Sheet.Header class="cn-forms-ingestionaccountssetup-975-1">
      <Sheet.Title>Set Up New Accounts</Sheet.Title>
      <Sheet.Description>
        Select imported accounts and map each one to a Beancount source account.
      </Sheet.Description>
    </Sheet.Header>

    <div class="cn-forms-ingestionaccountssetup-982-1">
      {#if discovering && unlinkedAccounts.length === 0}
        <p class="cn-forms-ingestionaccountssetup-984-1">
          Discovering accounts…
        </p>
      {:else if !unlinkedAccounts.length && selectableAccountCount > 0}
        <p class="cn-forms-ingestionaccountssetup-986-1">
          All discovered accounts are already linked.
        </p>
      {:else if !unlinkedAccounts.length}
        <p class="cn-forms-ingestionaccountssetup-990-1">
          No accounts to set up.
        </p>
      {:else}
        <ul class="cn-forms-ingestionaccountssetup-992-1" role="list">
          {#each unlinkedAccounts as account (account.id)}
            {@const checked = selectedIds.includes(account.id)}
            <li>
              <label class="cn-forms-ingestionaccountssetup-997-1">
                <input
                  type="checkbox"
                  class="cn-forms-ingestionaccountssetup-1001-1"
                  {checked}
                  aria-label={`Select ${account.name}`}
                  onchange={(event) =>
                    onToggleSetupAccount(
                      account.id,
                      event.currentTarget.checked,
                    )}
                />
                <span class="cn-forms-ingestionaccountssetup-1010-1">
                  <span class="cn-forms-ingestionaccountssetup-1012-1">
                    <span>{account.name}</span>
                    {#if account.closed}
                      <Badge
                        variant="outline"
                        class="cn-forms-ingestionaccountssetup-1016-1"
                        >Closed</Badge
                      >
                    {/if}
                  </span>
                  <span class="cn-forms-ingestionaccountssetup-1019-1">
                    {detailsFor(account)}
                  </span>
                </span>
              </label>
            </li>
          {/each}
        </ul>

        {#if selectedAccounts.length}
          <div class="cn-forms-ingestionaccountssetup-1029-1">
            <p class="cn-forms-ingestionaccountssetup-1031-1">
              Map to Beancount accounts
            </p>
            <ul class="cn-forms-ingestionaccountssetup-1035-1" role="list">
              {#each selectedAccounts as account (account.id)}
                <li class="cn-forms-ingestionaccountssetup-1038-1">
                  <div class="cn-forms-ingestionaccountssetup-1040-1">
                    <div class="cn-forms-ingestionaccountssetup-1042-1">
                      <span>{account.name}</span>
                      {#if account.closed}
                        <Badge
                          variant="outline"
                          class="cn-forms-ingestionaccountssetup-1046-1"
                          >Closed</Badge
                        >
                      {/if}
                    </div>
                    <p class="cn-forms-ingestionaccountssetup-1049-1">
                      {setupMappingDetails(account)}
                    </p>
                  </div>
                  <label class="cn-forms-ingestionaccountssetup-1053-1">
                    <span class="cn-forms-ingestionaccountssetup-1054-1">
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

    <Sheet.Footer class="cn-forms-ingestionaccountssetup-1073-1">
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
