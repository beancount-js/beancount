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
  import QueryResultsHarness from "./QueryResultsHarness.svelte";
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

<Story
  name="Mobile query results"
  globals={{ colorMode: "dark" }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("button", { name: "Sort by account" });
    const table =
      canvasElement.querySelector<HTMLElement>("[data-query-table]")!;
    const viewport = table.querySelector<HTMLElement>(
      '[data-ui-part="table-container"]',
    )!;
    await waitFor(() => {
      expect(viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
      const pagination = table.querySelector<HTMLElement>(
        "[data-query-pagination]",
      )!;
      expect(pagination.scrollWidth).toBeLessThanOrEqual(
        pagination.clientWidth + 1,
      );
    });
    viewport.scrollLeft = 300;
    expect(viewport.scrollLeft).toBeGreaterThan(0);
    await userEvent.click(canvas.getByRole("button", { name: /next page/i }));
    await expect(await canvas.findByText(/Showing 11–20 of/)).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Toggle AI panel" }),
    );
    await expect(
      canvas.getByRole("complementary", { name: "AI assistant" }),
    ).toBeVisible();
    await expectContainedShell(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Toggle AI panel" }),
    );
    await expect(canvas.getByRole("region", { name: "Query" })).toBeVisible();
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<div style="width: 390px; height: 100%; max-width: 100%">
      <ApplicationHarness
        scenario="review"
        displayMode="mobile"
        initialRoute={queryRoute}
      />
    </div>{/snippet}
</Story>

<Story
  name="Multiline query cells"
  parameters={{ beancountApplication: false }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("table", { name: "Result geometry fixture" });
    const table = canvasElement.querySelector("table")!;
    const headers = [...table.querySelectorAll("thead th")];
    for (const row of table.querySelectorAll("tbody tr")) {
      expectColumnsAligned(headers, [...row.children]);
      expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(56);
      expect(getComputedStyle(row.lastElementChild!).textAlign).toBe("right");
    }
    await userEvent.click(
      canvas.getByRole("button", { name: "Rows per page: 10" }),
    );
    await userEvent.click(
      await within(document.body).findByRole("option", {
        name: "25",
      }),
    );
    await expect(await canvas.findByText("Showing 1–25 of 31")).toBeVisible();
  }}
>
  {#snippet template()}<QueryResultsHarness />{/snippet}
</Story>

<Story
  name="Empty query and error"
  parameters={{ beancountApplication: false }}
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("No results.")).toBeVisible();
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Unknown query column: missing",
    );
  }}
>
  {#snippet template()}<QueryResultsHarness empty error />{/snippet}
</Story>

<Story
  name="Journal and account activity"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("radio", { name: "Transactions" });
    const journal = canvasElement.querySelector<HTMLElement>(
      "[data-journal-table]",
    )!;
    await waitFor(() =>
      expect(
        journal.querySelectorAll("[data-journal-group-toggle]").length,
      ).toBeGreaterThan(0),
    );
    await waitFor(() => {
      const postings = journal.querySelectorAll<HTMLElement>(
        "[data-journal-posting]",
      );
      expect(postings.length).toBeGreaterThan(0);
      for (const posting of postings) {
        const account = posting.firstElementChild!;
        const amount = posting.lastElementChild!;
        const accountLink = account.querySelector<HTMLElement>(
          "[data-account-navigation-link]",
        );
        expect(account.getBoundingClientRect().right).toBeLessThanOrEqual(
          amount.getBoundingClientRect().left + 1,
        );
        if (accountLink)
          expect(accountLink.getBoundingClientRect().right).toBeLessThanOrEqual(
            account.getBoundingClientRect().right + 1,
          );
      }
    });
    const shellBackground = getComputedStyle(
      canvasElement.querySelector<HTMLElement>(".ui-minimal-app-shell__main")!,
    ).backgroundColor;
    const activitySurfaces = journal.querySelectorAll<HTMLElement>(
      "[data-activity-surface]",
    );
    expect(activitySurfaces.length).toBeGreaterThan(0);
    for (const surface of activitySurfaces) {
      expect(getComputedStyle(surface).backgroundColor).toBe(shellBackground);
    }
    const toggle = journal.querySelector<HTMLElement>(
      "[data-journal-group-toggle]",
    )!;
    expect(
      toggle.closest("section")!.getBoundingClientRect().width,
    ).toBeLessThanOrEqual(journal.clientWidth + 1);
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(canvas.getByRole("button", { name: /next page/i }));
    await expect(await canvas.findByText(/Page 2 of/)).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: /^Select account:/ }),
    );
    await userEvent.click(
      await within(document.body).findByRole("option", {
        name: "Assets:Checking",
      }),
    );
    await waitFor(() =>
      expect(
        canvasElement.querySelector("[data-account-activity-table]"),
      ).toBeVisible(),
    );
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<ApplicationHarness
      scenario="review"
      displayMode="desktop"
      initialRoute="/journal"
    />{/snippet}
</Story>

<Story
  name="Holdings and statistics"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const name of ["Holdings", "Statistics"]) {
      if (name === "Statistics")
        await userEvent.click(canvas.getByRole("button", { name }));
      await canvas.findByRole("region", { name });
      await waitFor(() => {
        const table = canvasElement.querySelector("[data-query-table] table")!;
        const headers = [...table.querySelectorAll("thead th")];
        const rows = [...table.querySelectorAll("tbody tr")];
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows)
          expectColumnsAligned(headers, [...row.children]);
        expect(table.querySelector("[data-query-sort] svg")).toBeVisible();
      });
      const queryLink = canvas.getByRole("link", { name: "Query" });
      expect(queryLink).toHaveAttribute("data-ui-component", "button");
      const content = canvasElement.querySelector<HTMLElement>(
        '[data-content-scroll-area] [data-ui-part="scroll-area-viewport"]',
      )!;
      expect(content.scrollTop).toBe(0);
      const avatar = canvasElement.querySelector<HTMLElement>(
        ".beancount-account-avatar",
      )!;
      expect(avatar.getBoundingClientRect().width).toBe(28);
      const pagination = canvasElement.querySelector<HTMLElement>(
        "[data-page-pagination]",
      );
      if (pagination) {
        for (const button of pagination.querySelectorAll("button")) {
          expect(button.getBoundingClientRect().width).toBe(32);
          expect(button.getBoundingClientRect().height).toBe(32);
        }
        const selectedPage = pagination.querySelector<HTMLElement>(
          '[aria-current="page"]',
        )!;
        expect(selectedPage).toHaveTextContent("1");
        expect(getComputedStyle(selectedPage).backgroundColor).not.toBe(
          getComputedStyle(
            pagination.querySelector("button:not([aria-current])")!,
          ).backgroundColor,
        );
      }
      await expectContainedShell(canvasElement);
      content.scrollTop = 300;
    }
    await userEvent.click(canvas.getByRole("link", { name: "Query" }));
    await expect(
      await canvas.findByRole("region", { name: "Query" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expect(
      await canvas.findByRole("region", { name: "Statistics" }),
    ).toBeVisible();
  }}
>
  {#snippet template()}<ApplicationHarness
      scenario="preview"
      displayMode="desktop"
      initialRoute="/holdings"
    />{/snippet}
</Story>
