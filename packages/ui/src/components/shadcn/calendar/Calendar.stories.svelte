<script module lang="ts">
  import { CalendarDate } from "@internationalized/date";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import { Calendar } from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Forms/Calendar",
    component: Calendar,
    parameters: {
      docs: {
        description: {
          component:
            "UI-owned single-date calendar. Pair it with an appropriate trigger or date-input workflow rather than exposing it without context in application screens.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let selectedDate = $state<CalendarDate | undefined>(
    new CalendarDate(2026, 7, 18),
  );
</script>

<Story
  name="Selects a calendar date"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: /July 20, 2026/ }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent("2026-07-20");
  }}
>
  {#snippet template()}
    <div class="inline-flex flex-col rounded-lg border">
      <Calendar type="single" bind:value={selectedDate} />
      <output class="border-t px-3 py-2 text-sm text-muted-foreground">
        {selectedDate?.toString() ?? "No date selected"}
      </output>
    </div>
  {/snippet}
</Story>
