<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import { FormField, type FormCustomRenderer } from "@beancount-js/forms";
  import {
    secretField,
    type SourceFormContext,
  } from "../../ingestion/source-form-config";
  import SecretField from "./SecretField.svelte";

  type SecretRoot = { secretRef: string };

  const context: SourceFormContext = {
    accounts: [],
    envKeys: ["BANK_API_TOKEN", "LUNCHFLOW_API_KEY"],
  };

  const field = secretField<SecretRoot>({
    id: "api-secret",
    label: "API key",
    ariaLabel: "API key",
    envPlaceholder: "BANK_API_TOKEN",
    get: (root) => root.secretRef,
    set: (root, secretRef) => ({ ...root, secretRef }),
  });
  const SecretFormField = SecretField as FormCustomRenderer<
    SecretRoot,
    SourceFormContext,
    string
  >;

  const { Story } = defineMeta({
    title: "Fava/Forms/Secret Field",
    component: SecretField,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's ingestion secret adapter. It switches between a project environment-variable reference and a masked inline secret; use it for credentials only, never for an ordinary boolean or enum. See the [Form guidance](?path=/docs/ui-forms-guidance--docs) for the control-choice and validation rules.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let root = $state<SecretRoot>({ secretRef: "env:BANK_API_TOKEN" });

  function update(value: string) {
    root = field.set?.(root, value, context) ?? root;
  }
</script>

<Story
  name="Changes from an environment key to an inline secret"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Inline" }));
    await userEvent.type(
      canvas.getByPlaceholderText("Paste API key"),
      "sk_demo_123",
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Inline secret configured",
    );
  }}
>
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <FormField label={field.label} as="div" align="start">
        <SecretFormField
          {root}
          value={root.secretRef}
          {field}
          {context}
          issues={[]}
          view="edit"
          readonly={false}
          envPlaceholder="BANK_API_TOKEN"
          {update}
          updateRoot={(value) => {
            root = value;
          }}
        />
      </FormField>
      <output class="text-sm text-muted-foreground" aria-live="polite">
        {root.secretRef.startsWith("env:")
          ? `Environment key: ${root.secretRef.slice(4) || "Not selected"}`
          : root.secretRef
            ? "Inline secret configured"
            : "Secret not configured"}
      </output>
    </div>
  {/snippet}
</Story>

<Story name="Masks a read-only inline secret">
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <FormField label={field.label} as="div" align="start">
        <SecretFormField
          {root}
          value="sk_live_private"
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
