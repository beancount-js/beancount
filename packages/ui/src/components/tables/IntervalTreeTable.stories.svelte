<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import IntervalTreeTable, {
    type IntervalTreeColumn,
    type IntervalTreeNode,
  } from "./IntervalTreeTable.svelte";

  const columns = [
    {
      id: "june",
      label: "Jun 2026",
      title: "1 June – 1 July 2026",
      href: "/accounts/Expenses?time=Jun",
    },
    {
      id: "july",
      label: "Jul 2026",
      title: "1 July – 1 August 2026",
      href: "/accounts/Expenses?time=Jul",
    },
  ] satisfies readonly IntervalTreeColumn[];

  const nodes = [
    {
      id: "expenses",
      label: "Expenses",
      href: "/accounts/Expenses",
      cells: {
        june: {
          values: [
            {
              value: "£250.00",
              title: "Pounds sterling",
              difference: {
                value: "(+£30.00)",
                title: "Budget £280.00",
                tone: "positive",
              },
            },
          ],
        },
        july: {
          values: [
            {
              value: "£310.00",
              title: "Pounds sterling",
              difference: {
                value: "(+£10.00)",
                title: "Budget £320.00",
                tone: "positive",
              },
            },
          ],
        },
      },
      children: [
        {
          id: "expenses-groceries",
          label: "Groceries",
          href: "/accounts/Expenses:Groceries",
          cells: {
            june: {
              values: [
                {
                  value: "£180.00",
                  difference: {
                    value: "(+£20.00)",
                    title: "Budget £200.00",
                    tone: "positive",
                  },
                },
              ],
            },
            july: {
              values: [
                {
                  value: "£210.00",
                  difference: {
                    value: "(+£10.00)",
                    title: "Budget £220.00",
                    tone: "positive",
                  },
                },
              ],
            },
          },
        },
        {
          id: "expenses-dining",
          label: "Dining",
          href: "/accounts/Expenses:Dining",
          cells: {
            june: {
              values: [
                {
                  value: "£70.00",
                  difference: {
                    value: "(−£10.00)",
                    title: "Budget £80.00",
                    tone: "negative",
                  },
                },
              ],
            },
            july: {
              values: [
                {
                  value: "£100.00",
                  difference: {
                    value: "(−£0.00)",
                    title: "Budget £100.00",
                    tone: "negative",
                  },
                },
              ],
            },
          },
        },
      ],
    },
    {
      id: "expenses-unused",
      label: "Unused category",
      cells: {
        june: { values: [], dimmed: true },
        july: { values: [], dimmed: true },
      },
    },
  ] satisfies readonly IntervalTreeNode[];

  const { Story } = defineMeta({
    title: "Tables/Interval Tree Table",
    component: IntervalTreeTable,
    parameters: {
      docs: {
        description: {
          component:
            "A display-model-driven, multi-period account comparison. Pass formatted amounts and budget variance state per period; applications remain responsible for date ranges, currency formatting, account visibility, routes, and persisted disclosure preferences.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let selected = $state("");
</script>

<Story
  name="Compares periods and preserves account disclosure"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse Expenses" }),
    );
    await expect(
      canvas.queryByRole("link", { name: "Groceries" }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole("button", { name: "Expand Expenses" }),
    );
    await expect(canvas.getByRole("link", { name: "Groceries" })).toBeVisible();
  }}
>
  {#snippet template()}
    <div class="max-w-5xl p-5">
      <IntervalTreeTable {nodes} {columns} />
    </div>
  {/snippet}
</Story>

<Story
  name="Reports selected accounts"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("link", { name: "Dining" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Selected Dining",
    );
  }}
>
  {#snippet template()}
    <div class="max-w-5xl p-5">
      <IntervalTreeTable
        {nodes}
        {columns}
        onNavigate={(node) => {
          selected = node.label;
        }}
      />
      <output class="sr-only" aria-live="polite">
        {selected ? `Selected ${selected}` : "No account selected"}
      </output>
    </div>
  {/snippet}
</Story>
