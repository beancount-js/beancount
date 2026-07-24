<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import FormField from "./FormField.svelte";
  import AccountComboField from "./AccountComboField.svelte";
  import type { FormCustomRenderer } from "./types";

  type AccountRoot = { sourceAccount: string };

  const context = {
    accounts: ["Assets:Cash", "Assets:Current", "Expenses:Groceries"],
  };
  const field = {
    id: "source-account",
    label: "Source account",
    placeholder: "Select an account",
  };
  const AccountField = AccountComboField as FormCustomRenderer<
    AccountRoot,
    typeof context,
    string
  >;

  const { Story } = defineMeta({
    title: "UI Forms/Account Combo Field",
    component: AccountComboField,
    parameters: {
      docs: {
        description: {
          component:
            "A reusable ingestion-account selector that wraps a searchable picker inside a centered form row. Applications provide account options, current value, and update callbacks through `FormFieldRenderArgs`.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let root = $state<AccountRoot>({ sourceAccount: "" });
</script>

<Story
  name="Selects a source account"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Select an account" }),
    );
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole("option", { name: "Assets:Current" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Assets:Current",
    );
  }}
>
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <FormField label={field.label} as="div" align="center">
        <AccountField
          {root}
          value={root.sourceAccount}
          {field}
          {context}
          issues={[]}
          view="edit"
          readonly={false}
          update={(value) => {
            root = { sourceAccount: value };
          }}
          updateRoot={(value) => {
            root = value as AccountRoot;
          }}
        />
      </FormField>
      <output class="text-sm text-muted-foreground" aria-live="polite">
        Source account: {root.sourceAccount || "Not selected"}
      </output>
    </div>
  {/snippet}
</Story>

<Story name="Shows a read-only account">
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <FormField label={field.label} as="div" align="center">
        <AccountField
          {root}
          value="Expenses:Groceries"
          {field}
          {context}
          issues={[]}
          view="readonly"
          readonly={true}
          update={() => {}}
          updateRoot={() => {}}
        />
      </FormField>
    </div>
  {/snippet}
</Story>
