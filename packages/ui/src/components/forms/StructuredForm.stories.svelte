<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import StructuredForm from "./StructuredForm.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Structured Form",
    component: StructuredForm,
    parameters: {
      docs: {
        description: {
          component:
            "The configuration-driven runtime for schema-shaped data. It preserves the shared label/value grid while selecting fields from a typed form config. Use the composed UI primitives for one-off layouts; see the [Form guidance](?path=/docs/ui-forms-guidance--docs) for that choice.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import {
    booleanField,
    createFormConfig,
    segmentedField,
    textField,
  } from "./core";

  type LedgerSettings = {
    name: string;
    syncMode: string;
    enabled: boolean;
  };

  const config = createFormConfig<LedgerSettings>({
    id: "ledger-settings",
    fields: [
      textField({
        id: "ledger-name",
        label: "Ledger name",
        get: (settings) => settings.name,
        set: (settings, name) => ({ ...settings, name }),
      }),
      segmentedField({
        id: "sync-mode",
        label: "Sync mode",
        options: [
          { value: "automatic", label: "Automatic" },
          { value: "manual", label: "Manual" },
        ],
        get: (settings) => settings.syncMode,
        set: (settings, syncMode) => ({ ...settings, syncMode }),
      }),
      booleanField({
        id: "enabled",
        label: "Enabled",
        get: (settings) => settings.enabled,
        set: (settings, enabled) => ({ ...settings, enabled }),
      }),
    ],
  });

  let settings = $state<LedgerSettings>({
    name: "Northstar household",
    syncMode: "automatic",
    enabled: true,
  });
</script>

<Story
  name="Updates a schema-shaped settings form"
  play={async ({ canvas }) => {
    const name = canvas.getByRole("textbox", { name: "Ledger name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Northstar business");
    await userEvent.click(canvas.getByRole("button", { name: "Manual" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Northstar business uses manual sync",
    );
  }}
>
  {#snippet template()}
    <div class="max-w-2xl">
      <StructuredForm
        value={settings}
        {config}
        context={undefined}
        onChange={(next) => {
          settings = next;
        }}
      />
      <output class="mt-3 block text-sm text-muted-foreground">
        {settings.name} uses {settings.syncMode} sync and is {settings.enabled
          ? "enabled"
          : "disabled"}.
      </output>
    </div>
  {/snippet}
</Story>
