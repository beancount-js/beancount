<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import CycleSelect from "./CycleSelect.svelte";

  const { Story } = defineMeta({
    title: "Forms/Cycle Select",
    component: CycleSelect,
    parameters: {
      docs: {
        description: {
          component:
            "A compact previous/next navigator with a searchable selector for ordered sets. Use for small scoped option lists where keyboard or click cycling is expected.",
        },
      },
    },
  });

  const periods = [
    { value: "week", label: "This week" },
    { value: "month", label: "This month" },
    { value: "quarter", label: "This quarter" },
  ];

  const singlePeriod = [{ value: "week", label: "This week" }];
</script>

<script lang="ts">
  let period = $state("week");
</script>

<Story
  name="Cycles reporting periods"
  play={async ({ canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Select period" }),
    );
    const page = within(canvasElement.ownerDocument.body);
    const options = page.getAllByRole("option");
    const rowGap =
      options[1]!.getBoundingClientRect().top -
      options[0]!.getBoundingClientRect().bottom;
    await expect(
      Math.round(rowGap),
    ).toBeGreaterThanOrEqual(4);
    await userEvent.keyboard("{Escape}");

    await userEvent.click(canvas.getByRole("button", { name: "Next period" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Viewing: This month",
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Previous period" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Viewing: This week",
    );
  }}

  parameters={{
    visualDelta: {"images":["/visual-baselines/forms-cycle-select--cycles-reporting-periods-chromium-darwin.png"],"opacity":0.5,"colorInversion":false,"align":"canvas","placement":"right","passThresholdPercent":0.1},
  }}

  tags={["visual-approved"]}
>
  {#snippet template()}
    <div class="flex max-w-sm flex-col gap-3">
      <CycleSelect
        value={period}
        options={periods}
        label="Period"
        onChange={(value) => {
          period = value;
        }}
      />
      <output class="text-sm text-muted-foreground" aria-live="polite">
        Viewing: {periods.find((item) => item.value === period)?.label}
      </output>
    </div>
  {/snippet}
</Story>

<Story
  name="Disables unavailable navigation"
  play={async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole("button", { name: "Previous period" }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: "Next period" }),
    ).toBeDisabled();

    const trigger = canvas.getByRole("button", { name: "Select period" });
    await expect(trigger).toBeEnabled();
    await userEvent.click(trigger);

    const page = within(canvasElement.ownerDocument.body);
    await expect(page.getByRole("option", { name: "This week" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
  }}

  parameters={{
    visualDelta: {"images":["/visual-baselines/forms-cycle-select--disables-unavailable-navigation-chromium-darwin.png"],"opacity":0.5,"colorInversion":false,"align":"canvas","placement":"right","passThresholdPercent":0.1},
  }}

  tags={["visual-approved"]}
>
  {#snippet template()}
    <CycleSelect
      value="week"
      options={singlePeriod}
      label="Period"
      onChange={() => {}}
    />
  {/snippet}
</Story>
