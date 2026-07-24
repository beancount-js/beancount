<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import * as Alert from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Overlays/Alert",
    component: Alert.Root,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local inline alert for notable status and destructive error states. Keep the message specific and pair it with the action that resolves it.",
        },
      },
    },
  });
</script>

<Story name="Status and destructive alerts">
  {#snippet template()}
    <div class="max-w-xl space-y-4">
      <Alert.Root>
        <Alert.Title level="h3">Ledger synced</Alert.Title>
        <Alert.Description>
          18 new transactions were imported from your connected accounts.
        </Alert.Description>
      </Alert.Root>
      <Alert.Root variant="destructive">
        <Alert.Title level="h3">Unable to save changes</Alert.Title>
        <Alert.Description>
          Resolve the validation errors before saving this transaction.
        </Alert.Description>
      </Alert.Root>
    </div>
  {/snippet}
</Story>
