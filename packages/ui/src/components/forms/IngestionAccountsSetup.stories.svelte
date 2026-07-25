<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import IngestionAccountsSetup, {
    type IngestionAccountsConnection,
    type IngestionAccountsOtherGroup,
    type IngestionSetupAccount,
  } from "./IngestionAccountsSetup.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Ingestion Accounts Setup",
    component: IngestionAccountsSetup,
    parameters: {
      layout: "fullscreen",
    },
  });

  const accountItems = [
    { label: "Assets:Bank:Checking", value: "Assets:Bank:Checking" },
    { label: "Assets:Bank:Savings", value: "Assets:Bank:Savings" },
    { label: "Liabilities:CreditCard", value: "Liabilities:CreditCard" },
  ];

  const connections: IngestionAccountsConnection[] = [
    {
      id: "starling",
      name: "Starling Bank",
      selected: true,
      expanded: true,
      statusLine: "2 institutions · 2 synced, 1 needs setup",
      lastSyncLabel: "Last sync: 12 minutes ago",
      logoUrl:
        "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&w=96&h=96&q=80",
      syncing: false,
      canSync: true,
      canUpdateLogo: true,
      updatingLogo: false,
      saving: false,
      linkedCount: 2,
      unlinkedCount: 1,
      totalAccountCount: 3,
      institutionCount: 2,
      discoveryKnown: true,
      linkedPercent: 67,
      healthErrors: 0,
      syncSummaryOpen: true,
      syncSummaryTimeLabel: "Last synced 12 minutes ago",
      syncSeen: 48,
      syncUpdated: 0,
      syncImported: 17,
      syncSkipped: 31,
      showReviewCta: true,
      showSetupCta: true,
      linkedGroups: [
        {
          label: "Cash",
          balance: "1,240.00 GBP",
          accounts: [
            {
              id: "checking",
              name: "Checking",
              sourceAccount: "Assets:Bank:Checking",
              href: "/account/Assets:Bank:Checking",
              institution: "Starling",
              typeLabel: "Checking",
              balance: "1,240.00 GBP",
              defaultCurrency: "GBP",
              canEdit: true,
              avatar: {
                account: "Assets:Bank:Checking",
                color: "#1d4ed8",
                icon: "landmark",
              },
            },
            {
              id: "savings",
              name: "Savings",
              sourceAccount: "Assets:Bank:Savings",
              href: "/account/Assets:Bank:Savings",
              institution: "Starling",
              typeLabel: "Checking",
              balance: "3,920.00 GBP",
              defaultCurrency: "GBP",
              canEdit: true,
              avatar: {
                account: "Assets:Bank:Savings",
                color: "#15803d",
                icon: "landmark",
              },
            },
          ],
        },
      ],
    },
  ];

  const otherGroups: IngestionAccountsOtherGroup[] = [
    {
      label: "Expenses",
      balance: "640.00 GBP",
      open: true,
      accounts: [
        {
          name: "Expenses:Groceries",
          href: "/account/Expenses:Groceries",
          balance: "420.00 GBP",
          avatar: {
            account: "Expenses:Groceries",
            color: "#b45309",
            icon: "shopping-cart",
          },
        },
      ],
    },
  ];

  const unlinkedAccounts: IngestionSetupAccount[] = [
    {
      id: "joint",
      name: "Joint account",
      institutionName: "Starling",
      currency: "GBP",
      status: "active",
    },
  ];
</script>

<script lang="ts">
  let setupSheetOpen = $state(false);
  let selectedIds = $state<string[]>([]);
  let sourceAccounts = $state<Record<string, string>>({});
  let status = $state("");

  const selectedAccounts = $derived(
    unlinkedAccounts.filter((account) => selectedIds.includes(account.id)),
  );
</script>

<Story name="Default">
  {#snippet template()}
    <div class="h-[48rem] bg-background">
      <IngestionAccountsSetup
        connections={connections.map((connection) => ({ ...connection, status }))}
        otherAccountsOpen={true}
        otherAccountCount={1}
        otherAccountGroups={otherGroups}
        bind:setupSheetOpen
        unlinkedAccounts={unlinkedAccounts}
        selectableAccountCount={unlinkedAccounts.length}
        {selectedIds}
        {selectedAccounts}
        {sourceAccounts}
        {accountItems}
        canLink={selectedAccounts.every((account) =>
          Boolean(sourceAccounts[account.id]?.trim()),
        ) && selectedAccounts.length > 0}
        onOpenSetupSheet={() => {
          setupSheetOpen = true;
        }}
        onToggleSetupAccount={(id, checked) => {
          selectedIds = checked
            ? [...selectedIds, id]
            : selectedIds.filter((item) => item !== id);
        }}
        onSourceAccountChange={(id, value) => {
          sourceAccounts = { ...sourceAccounts, [id]: value };
        }}
        onCloseSetupSheet={() => {
          setupSheetOpen = false;
        }}
        onLinkAccounts={() => {
          status = "Linked 1 account.";
          setupSheetOpen = false;
        }}
      />
    </div>
  {/snippet}
</Story>
