<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import {
    createRuleRegistry,
    newRuleId,
    type DetectionRule,
  } from "@beancount-js/beangulp";
  import RuleEditorSheet from "./RuleEditorSheet.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Rule Editor Sheet",
    component: RuleEditorSheet,
    parameters: {
      docs: {
        description: {
          component:
            "Shared presentation for creating and editing detection rules. Callers supply rule content, accounts, registry metadata, and persistence callbacks.",
        },
      },
    },
  });

  const accounts = ["Assets:Checking", "Expenses:Food", "Income:Salary"];
  const registry = createRuleRegistry({ accounts: [...accounts] });
  const editRule: DetectionRule = {
    id: newRuleId(),
    name: "Groceries",
    resourceType: "transaction",
    active: true,
    effectiveDate: null,
    conditions: [
      {
        id: newRuleId(),
        conditionType: "transaction_account",
        operator: "=",
        value: "Expenses:Food",
      },
    ],
    actions: [
      {
        id: newRuleId(),
        actionType: "set_transaction_category",
        value: "Expenses:Food",
      },
    ],
  };
</script>

<script lang="ts">
  let open = $state(false);
</script>

<Story
  name="Edits a transaction rule"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Open transaction rule editor" }),
    );
    const dialog = within(document.body).getByRole("dialog");
    await expect(dialog).toHaveTextContent("Edit transaction rule 'Groceries'");
  }}
>
  {#snippet template()}
    <button
      type="button"
      class="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3"
      onclick={() => {
        open = true;
      }}
    >
      Open transaction rule editor
    </button>
    <RuleEditorSheet
      bind:open
      rule={editRule}
      {registry}
      {accounts}
      onSave={() => {
        // story-only callback
      }}
      onClosed={() => {
        // story-only callback
      }}
    />
  {/snippet}
</Story>
