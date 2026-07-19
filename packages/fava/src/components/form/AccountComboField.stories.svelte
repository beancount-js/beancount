<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import { FormField, type FormCustomRenderer } from "@beancount-js/forms";
  import {
    accountField,
    type SourceFormContext,
  } from "../../ingestion/source-form-config";
  import AccountComboField from "./AccountComboField.svelte";

  type AccountRoot = { sourceAccount: string };

  const context: SourceFormContext = {
    accounts: ["Assets:Cash", "Assets:Current", "Expenses:Groceries"],
  };

  const field = accountField<AccountRoot>({
    id: "source-account",
    label: "Source account",
    placeholder: "Select an account",
    get: (root) => root.sourceAccount,
    set: (root, sourceAccount) => ({ ...root, sourceAccount }),
  });
  const AccountField = AccountComboField as FormCustomRenderer<
    AccountRoot,
    SourceFormContext,
    string
  >;

  const { Story } = defineMeta({
    title: "Fava/Forms/Account Combo Field",
    component: AccountComboField,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's ingestion-form adapter for a searchable account value. It uses the shared Filter Command Picker within a centered structured-form row. Use it only where the ingestion context supplies accounts; see the [Form guidance](?path=/docs/ui-forms-guidance--docs) for the picker and row rules.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let root = $state<AccountRoot>({ sourceAccount: "" });

  function update(value: string) {
    root = field.set?.(root, value, context) ?? root;
  }
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
          {update}
          updateRoot={(value) => {
            root = value;
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
          {update}
          updateRoot={() => {}}
        />
      </FormField>
    </div>
  {/snippet}
</Story>
