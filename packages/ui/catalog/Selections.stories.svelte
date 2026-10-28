<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  import SelectionLegendHarness from "./SelectionLegendHarness.svelte";
  import { expectVisibleToggleSelection } from "./selection-assertions";

  const { Story } = defineMeta({
    title: "Beancount/Selections",
    component: BeancountApplication,
    parameters: { beancountApplication: true },
  });

  async function applicationSelections({
    canvasElement,
  }: {
    canvasElement: HTMLElement;
  }) {
    const canvas = within(canvasElement);
    const cost = await canvas.findByRole("radio", { name: "At Cost" });
    const valuation = cost.closest<HTMLElement>("[data-beancount-toggle]")!;
    await expectVisibleToggleSelection(valuation, ["AT_COST"]);
    await userEvent.click(canvas.getByRole("radio", { name: "Units" }));
    await expectVisibleToggleSelection(valuation, ["UNITS"]);
    await userEvent.click(
      canvas.getByRole("radio", { name: "At Market Value" }),
    );
    await expectVisibleToggleSelection(valuation, ["AT_VALUE"]);
    await userEvent.click(cost);

    await userEvent.click(canvas.getByRole("button", { name: "Journal" }));
    const transactions = await canvas.findByRole("radio", {
      name: "Transactions",
    });
    const timeframe = transactions.closest<HTMLElement>(
      "[data-beancount-toggle]",
    )!;
    await expectVisibleToggleSelection(timeframe, ["transactions"]);
    const upcoming = canvas.getByRole("radio", { name: "Upcoming" });
    upcoming.focus();
    await userEvent.keyboard("{Enter}");
    await expectVisibleToggleSelection(timeframe, ["upcoming"]);
    expect(getComputedStyle(upcoming).outlineStyle).toBe("solid");
    expect(getComputedStyle(upcoming).outlineWidth).toBe("2px");
    await userEvent.click(transactions);
    await expectVisibleToggleSelection(timeframe, ["transactions"]);
  }

  async function reviewSelections({
    canvasElement,
  }: {
    canvasElement: HTMLElement;
  }) {
    const canvas = within(canvasElement);
    const review = await canvas.findByRole("radio", { name: /^Review/ });
    const filter = review.closest<HTMLElement>("[data-beancount-toggle]")!;
    await expectVisibleToggleSelection(filter, ["pending"]);
    await userEvent.click(canvas.getByRole("radio", { name: /^Ready/ }));
    await expectVisibleToggleSelection(filter, ["accepted"]);
    await userEvent.click(canvas.getByRole("radio", { name: /^Reconcile/ }));
    await expectVisibleToggleSelection(filter, ["reconciliation"]);

    // Dialog content is portalled outside .beancount-application.
    await userEvent.click(canvas.getByRole("button", { name: "Rules" }));
    const apply = await canvas.findByRole("button", {
      name: "Apply all",
    });
    await waitFor(() => expect(apply).toBeEnabled());
    await userEvent.click(apply);
    const dialog = within(await within(document.body).findByRole("dialog"));
    const live = dialog.getByRole("radio", { name: "Live ledger" });
    const target = live.closest<HTMLElement>("[data-beancount-toggle]")!;
    expect(target.closest(".beancount-application")).toBeNull();
    await expectVisibleToggleSelection(target, ["live-ledger"]);
    await userEvent.click(
      dialog.getByRole("radio", { name: "Pending imports" }),
    );
    await expectVisibleToggleSelection(target, ["pending-imports"]);
    await userEvent.click(dialog.getByRole("radio", { name: "Both" }));
    await expectVisibleToggleSelection(target, ["both"]);
    await userEvent.keyboard("{Escape}");
    const back = canvas.getByRole("button", {
      name: "Back to ledger navigation",
    });
    await waitFor(() => {
      expect(within(document.body).queryByRole("dialog")).toBeNull();
      expect(getComputedStyle(back).pointerEvents).not.toBe("none");
    });
    await userEvent.click(back);
  }

  async function legendSelections({
    canvasElement,
  }: {
    canvasElement: HTMLElement;
  }) {
    const canvas = within(canvasElement);
    const single = within(
      canvas.getByRole("region", { name: "Single chart series" }),
    );
    const multiple = within(
      canvas.getByRole("region", { name: "Multiple chart series" }),
    );
    const singleGroup = single
      .getByRole("radio", { name: "Toggle Income" })
      .closest<HTMLElement>("[data-beancount-toggle]")!;
    const multiGroup = multiple
      .getByRole("button", { name: "Toggle Income" })
      .closest<HTMLElement>("[data-beancount-toggle]")!;
    await expectVisibleToggleSelection(singleGroup, ["Income"]);
    await userEvent.click(
      single.getByRole("radio", { name: "Toggle Expenses" }),
    );
    await expectVisibleToggleSelection(singleGroup, ["Expenses"]);
    await expectVisibleToggleSelection(multiGroup, ["Income"]);
    await userEvent.click(
      multiple.getByRole("button", { name: "Toggle Expenses" }),
    );
    await expectVisibleToggleSelection(multiGroup, ["Income", "Expenses"]);
    await userEvent.click(
      multiple.getByRole("button", { name: "Toggle Income" }),
    );
    await expectVisibleToggleSelection(multiGroup, ["Expenses"]);
    await userEvent.click(
      multiple.getByRole("button", { name: "Toggle Expenses" }),
    );
    await expectVisibleToggleSelection(multiGroup, []);
  }
</script>

<Story
  name="Application light"
  globals={{ colorMode: "light" }}
  play={applicationSelections}
>
  {#snippet template()}<ApplicationHarness displayMode="desktop" />{/snippet}
</Story>
<Story
  name="Application dark"
  globals={{ colorMode: "dark" }}
  play={applicationSelections}
>
  {#snippet template()}<ApplicationHarness displayMode="desktop" />{/snippet}
</Story>
<Story
  name="Chart legends light"
  globals={{ colorMode: "light" }}
  play={legendSelections}
>
  {#snippet template()}<SelectionLegendHarness />{/snippet}
</Story>
<Story
  name="Review controls light"
  globals={{ colorMode: "light" }}
  play={reviewSelections}
>
  {#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/records"
    />{/snippet}
</Story>
<Story
  name="Review controls dark"
  globals={{ colorMode: "dark" }}
  play={reviewSelections}
>
  {#snippet template()}<ApplicationHarness
      displayMode="desktop"
      initialRoute="/records"
    />{/snippet}
</Story>
<Story
  name="Chart legends dark"
  globals={{ colorMode: "dark" }}
  play={legendSelections}
>
  {#snippet template()}<SelectionLegendHarness />{/snippet}
</Story>
