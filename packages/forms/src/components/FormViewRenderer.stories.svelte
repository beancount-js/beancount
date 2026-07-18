<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import FormViewRenderer from "./FormViewRenderer.svelte";

  const { Story } = defineMeta({
    title: "Forms/Form View Renderer",
    component: FormViewRenderer,
    parameters: {
      docs: {
        description: {
          component:
            "A read-only view over a configured Structured Form. Use it for a stable configuration summary; it deliberately does not create a separate display layout that can drift from the editable form.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { createFormConfig, readonlyField, textField } from "../core";

  type ConnectionSummary = { account: string; endpoint: string };

  const config = createFormConfig<ConnectionSummary>({
    id: "connection-summary",
    fields: [
      textField({
        id: "account",
        label: "Import account",
        get: (summary) => summary.account,
        set: (summary, account) => ({ ...summary, account }),
      }),
      readonlyField({
        id: "endpoint",
        label: "Endpoint",
        get: (summary) => summary.endpoint,
      }),
    ],
  });

  const value: ConnectionSummary = {
    account: "Assets:Bank:Checking",
    endpoint: "https://api.northstar.example/card",
  };
</script>

<Story name="Shows a read-only configuration summary">
  {#snippet template()}
    <div class="max-w-2xl">
      <FormViewRenderer {value} {config} view="readonly" />
    </div>
  {/snippet}
</Story>
