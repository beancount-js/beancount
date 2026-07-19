<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import type { DateValue } from "@internationalized/date";
  import DatePicker from "./DatePicker.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Date Picker",
    component: DatePicker,
    parameters: {
      docs: {
        description: {
          component:
            "A controlled date picker with a compact set of relative-date shortcuts. Use it for date configuration, not for CodeMirror extension plumbing; applications keep parsing, editor extensions, and persistence outside the UI package. See the [Form guidance](?path=/docs/ui-forms-guidance--docs).",
        },
      },
    },
  });
</script>

<script lang="ts">
  let dueDate = $state<DateValue | undefined>();
</script>

<Story
  name="Selects a relative date from the popover"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Due date" }));
    const options = within(document.body);
    await userEvent.click(
      options.getByRole("button", { name: "Choose a date shortcut" }),
    );
    await userEvent.click(options.getByRole("option", { name: "Tomorrow" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "A due date is selected",
    );
  }}
>
  {#snippet template()}
    <div class="flex max-w-sm flex-col gap-3 p-5">
      <DatePicker bind:value={dueDate} ariaLabel="Due date" />
      <output class="text-sm text-muted-foreground" aria-live="polite">
        {dueDate ? "A due date is selected" : "No due date selected"}
      </output>
    </div>
  {/snippet}
</Story>

<Story name="Shows a disabled field">
  {#snippet template()}
    <div class="p-5">
      <DatePicker ariaLabel="Locked settlement date" disabled />
    </div>
  {/snippet}
</Story>
