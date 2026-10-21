<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import {
    expect,
    userEvent,
    waitFor,
    within,
    fireEvent,
  } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  import { expectContainedShell } from "./layout-assertions";
  import {
    expectColumnsAligned,
    expectGridGeometry,
    expectStatementGeometry,
  } from "./table-assertions";
  const { Story } = defineMeta({
    title: "Beancount/Tables",
    component: BeancountApplication,
    parameters: { beancountApplication: true },
  });
  const queryRoute =
    "/query?qs=" +
    encodeURIComponent(
      "SELECT date, narration, account, number, meta('note') AS note",
    );
</script>

<Story
  name="Statement trees"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("region", { name: "Balance Sheet" });
    await expectStatementGeometry(canvasElement);
    for (const name of ["Income Statement", "Trial Balance"]) {
      await userEvent.click(canvas.getByRole("button", { name }));
      await canvas.findByRole("region", { name });
      await expectStatementGeometry(canvasElement);
    }
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<ApplicationHarness
      scenario="review"
      displayMode="desktop"
      initialRoute="/balance_sheet"
    />{/snippet}
</Story>

<Story
  name="Interval trees"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("tab", { name: /^Balances/ }),
    );
    await waitFor(() =>
      expect(
        [...canvasElement.querySelectorAll("[data-interval-tree-table]")].find(
          (table) => table.getBoundingClientRect().height > 0,
        ),
      ).toBeVisible(),
    );
    const table = [
      ...canvasElement.querySelectorAll<HTMLElement>(
        "[data-interval-tree-table]",
      ),
    ].find((table) => table.getBoundingClientRect().height > 0)!;
    const headers = [...table.querySelectorAll(".head p > span")];
    const rows = [...table.querySelectorAll("li:not(.head) > p")];
    for (const row of rows) {
      const cells = [...row.children];
      // Hierarchy indentation only changes the account cell; numeric edges align.
      expectColumnsAligned(headers.slice(1), cells.slice(1));
      expect(getComputedStyle(cells[1]!).borderBottomWidth).toBe("1px");
      expect(getComputedStyle(cells[1]!).borderTopWidth).toBe("0px");
      expect(getComputedStyle(row).marginTop).toBe("0px");
    }
    const viewport = table.closest(
      '[data-ui-part="scroll-area-viewport"]',
    ) as HTMLElement;
    viewport.scrollLeft = 240;
    expect(viewport.scrollLeft).toBeGreaterThan(0);
    expect(
      Math.abs(
        headers[0]!.getBoundingClientRect().left -
          viewport.getBoundingClientRect().left,
      ),
    ).toBeLessThanOrEqual(2);
    viewport.scrollLeft = 0;
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<div style="width: 390px; height: 100%; max-width: 100%">
      <ApplicationHarness
        scenario="review"
        displayMode="mobile"
        initialRoute="/account/Assets"
      />
    </div>{/snippet}
</Story>

<Story
  name="Query results"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sort = await canvas.findByRole("button", { name: "Sort by account" });
    const table =
      canvasElement.querySelector<HTMLElement>("[data-query-table]")!;
    await waitFor(() => {
      const headers = [...table.querySelectorAll("thead th")];
      const rows = [...table.querySelectorAll("tbody tr")];
      expect(rows.length).toBe(10);
      for (const row of rows) expectColumnsAligned(headers, [...row.children]);
    });
    sort.focus();
    await userEvent.keyboard("{Enter}");
    await expect(sort.closest("th")).toHaveAttribute("aria-sort", "ascending");
    await userEvent.keyboard(" ");
    await expect(sort.closest("th")).toHaveAttribute("aria-sort", "descending");
    await userEvent.keyboard("{Enter}");
    await expect(sort.closest("th")).toHaveAttribute("aria-sort", "none");
    await expect(canvas.getByText(/Showing 1–10 of/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: /next page/i }));
    await expect(await canvas.findByText(/Showing 11–20 of/)).toBeVisible();
    const frame = table.querySelector<HTMLElement>(
      '[data-ui-part="table-container"]',
    )!;
    expect(frame.scrollHeight).toBeLessThanOrEqual(frame.clientHeight + 1);
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<ApplicationHarness
      scenario="review"
      displayMode="desktop"
      initialRoute={queryRoute}
    />{/snippet}
</Story>

<Story
  name="Legacy all accounts"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("button", { name: /^Date: sort/ });
    const table = canvasElement.querySelector<HTMLElement>("[data-grid-list]")!;
    await waitFor(() => {
      const headers = [...table.querySelectorAll(".head p > span")];
      const row = table.querySelector(
        ".virtual-list-inner [data-grid-row] > p",
      )!;
      expectColumnsAligned(headers, [...row.children]);
    });
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<ApplicationHarness
      scenario="review"
      displayMode="desktop"
      initialRoute="/accounts"
    />{/snippet}
</Story>
