<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import * as Table from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Data Display/Table",
    component: Table.Root,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local semantic table composition. Use a caption, explicit column headers, and the shared cells and rows rather than div-based table layouts.",
        },
      },
    },
  });
</script>

<Story name="Displays selected transaction rows">
  {#snippet template()}
    <div class="max-w-2xl rounded-md border">
      <Table.Root>
        <Table.Caption>Recent ledger transactions</Table.Caption>
        <Table.Header>
          <Table.Row>
            <Table.Head scope="col">Date</Table.Head>
            <Table.Head scope="col">Description</Table.Head>
            <Table.Head scope="col" class="text-right">Amount</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row data-state="selected">
            <Table.Cell>18 Jul 2026</Table.Cell>
            <Table.Cell>Groceries</Table.Cell>
            <Table.Cell class="text-right">£42.17</Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell>17 Jul 2026</Table.Cell>
            <Table.Cell>Salary</Table.Cell>
            <Table.Cell class="text-right">£3,200.00</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>
    </div>
  {/snippet}
</Story>
