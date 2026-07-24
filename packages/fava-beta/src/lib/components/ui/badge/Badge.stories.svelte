<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { Badge } from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Data Display/Badge",
    component: Badge,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local compact status marker. Choose the variant that communicates state, and keep the label short and meaningful without relying only on colour.",
        },
      },
    },
  });
</script>

<Story name="Communicates account states">
  {#snippet template()}
    <div class="flex flex-wrap gap-2">
      <Badge>Connected</Badge>
      <Badge variant="success">Imported</Badge>
      <Badge variant="warning">Needs review</Badge>
      <Badge variant="destructive">Sync failed</Badge>
      <Badge variant="outline">Draft</Badge>
    </div>
  {/snippet}
</Story>
