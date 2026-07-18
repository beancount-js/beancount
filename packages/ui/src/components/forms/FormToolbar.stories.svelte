<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import FormToolbar from "./FormToolbar.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Form Toolbar",
    component: FormToolbar,
    parameters: {
      docs: {
        description: {
          component:
            "The form-level toolbar. It owns the collapse-all control and optional summary/actions; its callback must collapse or expand every descendant disclosure, including nested repeatable entries.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let collapsedAll = $state(false);
</script>

<Story
  name="Collapses every section"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Collapse all" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "All sections collapsed",
    );
  }}
>
  {#snippet template()}
    <div class="max-w-md space-y-2">
      <FormToolbar
        {collapsedAll}
        onToggleCollapse={() => (collapsedAll = !collapsedAll)}
      >
        {#snippet leading()}
          <span class="text-sm font-medium">Source settings</span>
        {/snippet}
        {#snippet actions()}
          <button type="button" class="text-sm text-muted-foreground"
            >Save draft</button
          >
        {/snippet}
      </FormToolbar>
      <output class="text-sm text-muted-foreground">
        {collapsedAll ? "All sections collapsed" : "All sections expanded"}
      </output>
    </div>
  {/snippet}
</Story>
