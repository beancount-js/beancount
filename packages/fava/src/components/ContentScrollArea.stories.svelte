<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import ContentScrollArea from "./ContentScrollArea.svelte";

  const { Story } = defineMeta({
    title: "Fava/Layout/Content Scroll Area",
    component: ContentScrollArea,
    parameters: {
      docs: {
        description: {
          component:
            "The Fava page-body scroll container. Use it when independently scrollable content must retain the shared Scroll Area styling without adding another layout or table primitive.",
        },
      },
    },
  });

  const ledgerLines = [
    "2026-07-18 open Assets:Cash",
    "2026-07-18 open Expenses:Groceries",
    '2026-07-18 * "Opening balance"',
    "  Assets:Cash              1,250.00 GBP",
    "  Equity:Opening-Balances -1,250.00 GBP",
    '2026-07-19 * "Groceries"',
    "  Expenses:Groceries          42.17 GBP",
    "  Assets:Cash                -42.17 GBP",
  ];
</script>

<Story name="Contains a long ledger note">
  {#snippet template()}
    <section
      class="h-48 max-w-xl overflow-hidden rounded-lg border bg-card"
      aria-label="Ledger source preview"
    >
      <ContentScrollArea contentClass="p-4">
        <pre
          class="m-0 font-mono text-xs leading-6 text-foreground">{Array.from(
            { length: 4 },
            () => ledgerLines,
          )
            .flat()
            .join("\n")}</pre>
      </ContentScrollArea>
    </section>
  {/snippet}
</Story>
