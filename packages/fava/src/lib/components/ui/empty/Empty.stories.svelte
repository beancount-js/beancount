<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Plus from "lucide-svelte/icons/plus";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Data Display/Empty",
    component: Empty.Root,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local empty-state composition. Explain what is absent, why it matters, and provide the next useful action when one exists.",
        },
      },
    },
  });
</script>

<Story name="Guides a first source connection">
  {#snippet template()}
    <div class="h-72 max-w-xl rounded-md border">
      <Empty.Root>
        <Empty.Header>
          <Empty.Media variant="icon"><Plus /></Empty.Media>
          <Empty.Title>No sources connected</Empty.Title>
          <Empty.Description>
            Connect a bank or import a file to start reviewing transactions.
          </Empty.Description>
        </Empty.Header>
        <Empty.Content>
          <Button>Connect a source</Button>
        </Empty.Content>
      </Empty.Root>
    </div>
  {/snippet}
</Story>
