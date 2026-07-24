<script lang="ts" module>
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import BookUser from "lucide-svelte/icons/book-user";
  import ClipboardList from "lucide-svelte/icons/clipboard-list";
  import History from "lucide-svelte/icons/history";
  import Landmark from "lucide-svelte/icons/landmark";
  import RefreshCw from "lucide-svelte/icons/refresh-cw";
  import Store from "lucide-svelte/icons/store";
  import Wand2 from "lucide-svelte/icons/wand-2";
  import LedgerSettingsNavigation, {
    type LedgerSettingsNavigationItem,
  } from "./LedgerSettingsNavigation.svelte";

  const { Story } = defineMeta({
    title: "Navigation/Ledger Settings Navigation",
    component: LedgerSettingsNavigation,
    tags: ["visual-pending"],
    parameters: {
      docs: {
        description: {
          component:
            "A controlled settings hierarchy for a ledger workspace. Applications retain their routes and disclosure state.",
        },
      },
    },
  });

  const items = [
    { id: "accounts", label: "Accounts", icon: Landmark },
    {
      id: "bank-sync",
      label: "Bank Sync",
      icon: RefreshCw,
      expanded: true,
      disclosureLabel: "import",
      children: [
        { id: "history", label: "History", icon: History },
        {
          id: "review",
          label: "Review",
          icon: ClipboardList,
          groupActive: true,
          expanded: true,
          disclosureLabel: "review",
          badge: "12",
          badgeTitle: "12 items in active review",
          children: [
            { id: "review-merchants", label: "Merchants", icon: Store },
          ],
        },
      ],
    },
    { id: "merchants", label: "Merchants", icon: BookUser, active: true },
    { id: "rules", label: "Rules", icon: Wand2 },
  ] satisfies LedgerSettingsNavigationItem[];
</script>

<Story name="Displays settings destinations" args={{ items, onBack: fn(), onSelect: fn(), onExpandedChange: fn() }}>
  {#snippet template(args)}
    <div class="flex h-[32rem] w-80 overflow-hidden rounded-xl border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground shadow-sm">
      <LedgerSettingsNavigation {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Collapses nested settings"
  args={{ items, onBack: fn(), onSelect: fn(), onExpandedChange: fn() }}
  play={async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse import navigation" }),
    );
    await expect(args.onExpandedChange).toHaveBeenCalledWith("bank-sync", false);
    await expect(canvas.getByRole("button", { name: "History" })).toBeVisible();
  }}
>
  {#snippet template(args)}
    <div class="flex h-[32rem] w-80 overflow-hidden rounded-xl border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground shadow-sm">
      <LedgerSettingsNavigation {...args} />
    </div>
  {/snippet}
</Story>
