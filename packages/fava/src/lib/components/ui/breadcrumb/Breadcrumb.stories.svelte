<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import * as Breadcrumb from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Layout/Breadcrumb",
    component: Breadcrumb.Root,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local breadcrumb composition for showing the current place within ledger navigation. Mark only the current page as non-link text.",
        },
      },
    },
  });
</script>

<Story name="Shows a ledger hierarchy">
  {#snippet template()}
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link href="/accounts">Accounts</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Link href="/accounts/expenses">Expenses</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Page>Groceries</Breadcrumb.Page>
        </Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
  {/snippet}
</Story>
