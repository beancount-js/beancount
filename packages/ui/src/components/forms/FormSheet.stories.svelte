<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import FormSheet from "./FormSheet.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Form Sheet",
    component: FormSheet,
    parameters: {
      docs: {
        description: {
          component:
            "A right-side workflow frame for editing a focused record without leaving the current page. It owns the dialog title focus, close affordance, scrollable body, and optional collapse-all control. The workflow supplies its state and must make collapse-all cover every descendant disclosure; see the [Form guidance](?path=/docs/ui-forms-guidance--docs).",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { Button } from "../shadcn/button";

  let open = $state(false);
  let collapsedAll = $state(false);
</script>

<Story
  name="Focuses, collapses, and closes an editing workflow"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Edit import" }));
    const dialog = within(document.body).getByRole("dialog", {
      name: "Import proposal",
    });
    await expect(dialog).toBeVisible();
    await expect(document.activeElement).toBe(
      within(dialog).getByText("Import proposal"),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Collapse all" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "All sections collapsed",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent("closed");
  }}
>
  {#snippet template()}
    <div class="space-y-3">
      <Button onclick={() => (open = true)}>Edit import</Button>
      <FormSheet
        bind:open
        title="Import proposal"
        description="Review and edit this import proposal."
        {collapsedAll}
        onToggleCollapse={() => (collapsedAll = !collapsedAll)}
      >
        {#snippet titleSuffix()}
          <span
            class="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground"
            >3</span
          >
        {/snippet}
        {#snippet children()}
          <p class="text-sm text-muted-foreground">
            {collapsedAll
              ? "The proposal sections are collapsed."
              : "The proposal sections are expanded."}
          </p>
        {/snippet}
      </FormSheet>
      <output class="text-sm text-muted-foreground">
        {open
          ? collapsedAll
            ? "All sections collapsed"
            : "All sections expanded"
          : "closed"}
      </output>
    </div>
  {/snippet}
</Story>
