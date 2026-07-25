<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import FormField from "./FormField.svelte";
  import AccountPicker from "./AccountPicker.svelte";
  import type { FormCustomRenderer, FormFieldConfig } from "./types";

  const accounts = ["Assets:Cash", "Assets:Bank:Current", "Expenses:Groceries"];
  type AccountRoot = { sourceAccount: string };
  const context = {
    accounts: ["Assets:Cash", "Assets:Current", "Expenses:Groceries"],
  };
  const field = {
    id: "source-account",
    label: "Source account",
    placeholder: "Select an account",
    kind: "custom",
    get: (root: AccountRoot) => root.sourceAccount,
  } satisfies FormFieldConfig<AccountRoot, typeof context, string>;
  const AccountField = AccountPicker as unknown as FormCustomRenderer<
    AccountRoot,
    typeof context,
    string
  >;

  const { Story } = defineMeta({
    title: "UI Forms/Account Picker",
    component: AccountPicker,
    parameters: {
      docs: {
        description: {
          component:
            'A data-driven account selector built on the canonical Filter Command Picker. Applications supply account names and persist the selected value. In forms, use it in `FormField as="div" align="center"`. See the [Form guidance](?path=/docs/ui-forms-guidance--docs) for searchable-choice rules.',
        },
      },
    },
  });
</script>

<script lang="ts">
  let account = $state("");
  let root = $state<AccountRoot>({ sourceAccount: "" });
</script>

<Story
  name="Selects an account"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Source account" }),
    );
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await page.findByRole("option", { name: "Expenses:Groceries" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Expenses:Groceries",
    );
  }}

  parameters={{
    visualDelta: {"images":["/visual-baselines/ui-forms-account-picker--selects-an-account-chromium-darwin.png"],"opacity":0.5,"colorInversion":false,"align":"canvas","placement":"right","passThresholdPercent":0.1},
  }}

  tags={["visual-approved"]}
>
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <FormField label="Source account" as="div" align="center">
        <AccountPicker
          {accounts}
          value={account}
          label="Source account"
          onChange={(value) => {
            account = value;
          }}
        />
      </FormField>
      <output class="text-sm text-muted-foreground" aria-live="polite">
        Account: {account || "Not selected"}
      </output>
    </div>
  {/snippet}
</Story>

<Story name="Shows an account in read-only mode"
  parameters={{
    visualDelta: {"images":["/visual-baselines/ui-forms-account-picker--shows-an-account-in-read-only-mode-chromium-darwin.png"],"opacity":0.5,"colorInversion":false,"align":"canvas","placement":"right","passThresholdPercent":0.1},
  }}

  tags={["visual-approved"]}
>
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <FormField label="Source account" as="div" align="center">
        <AccountPicker
          {accounts}
          value="Assets:Bank:Current"
          label="Source account"
          readOnly
        />
      </FormField>
    </div>
  {/snippet}
</Story>

<Story
  name="Works as a form renderer"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Source account" }),
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
