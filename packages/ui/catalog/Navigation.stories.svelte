<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  import { expectContainedShell } from "./layout-assertions";
  async function expectSelectedChoice(
    canvas: HTMLElement,
    selector: string,
    value: string,
  ) {
    await waitFor(() => {
      const choices = [...canvas.querySelectorAll<HTMLElement>(selector)];
      const selected = choices.find(
        (choice) => choice.getAttribute("data-state") === "on",
      )!;
      expect(selected).toHaveAttribute("data-value", value);
      expect(selected).toHaveAttribute("aria-checked", "true");
      for (const other of choices.filter((choice) => choice !== selected)) {
        expect(other).toHaveAttribute("aria-checked", "false");
        expect(getComputedStyle(selected).backgroundColor).not.toBe(
          getComputedStyle(other).backgroundColor,
        );
      }
      expect(getComputedStyle(selected).borderTopStyle).toBe("solid");
      expect(getComputedStyle(selected).boxShadow).not.toBe("none");
      expect(getComputedStyle(selected).backgroundColor).toBe(
        getComputedStyle(document.body).backgroundColor,
      );
    });
  }
  async function expectTreePresentation(canvas: HTMLElement) {
    await expectSelectedChoice(canvas, "[data-workspace-view]", "ledgers");
    const parent = canvas.querySelector<HTMLElement>(
      "[data-ledger-file-node]:has([data-ledger-file-panels])",
    )!;
    expect(
      getComputedStyle(
        parent.querySelector<HTMLElement>("[data-ledger-file-panels]")!,
      ).rowGap,
    ).toBe("4px");
    const treeNodes = canvas.querySelectorAll<HTMLElement>(
      "[data-ledger-file-node], [data-review-ledger-node], [data-ledger-folder-node], [data-ledger-tag-node]",
    );
    expect(treeNodes.length).toBeGreaterThan(0);
    for (const node of treeNodes) {
      expect(getComputedStyle(node).rowGap).toBe("4px");
    }
    const icon = parent.querySelector("[data-ledger-file-row] svg")!;
    for (const report of parent.querySelectorAll(
      "[data-ledger-report-row] svg",
    )) {
      expect(
        Math.abs(
          icon.getBoundingClientRect().left -
            report.getBoundingClientRect().left,
        ),
      ).toBeLessThanOrEqual(1);
    }
    const row = canvas.querySelector<HTMLElement>(
      '[data-ledger-tree-row][data-active="false"]',
    )!;
    const background = getComputedStyle(row).backgroundColor;
    if (import.meta.env.MODE !== "test") return;
    const { page } = await import("vitest/browser");
    for (const button of row.querySelectorAll("button")) {
      await page.elementLocator(button).hover();
      await waitFor(() =>
        expect(getComputedStyle(row).backgroundColor).not.toBe(background),
      );
      for (const control of row.querySelectorAll("button")) {
        expect(getComputedStyle(control).backgroundColor).toBe(
          "rgba(0, 0, 0, 0)",
        );
      }
      await page.elementLocator(button).unhover();
      await waitFor(() =>
        expect(getComputedStyle(row).backgroundColor).toBe(background),
      );
    }
    const selectedTreeRow = canvas.querySelector<HTMLElement>(
      '[data-ledger-tree-row][data-active="true"]',
    )!;
    const selectedTreeBackground =
      getComputedStyle(selectedTreeRow).backgroundColor;
    await page.elementLocator(selectedTreeRow).hover();
    await waitFor(() =>
      expect(getComputedStyle(selectedTreeRow).backgroundColor).toBe(
        selectedTreeBackground,
      ),
    );
    await page.elementLocator(selectedTreeRow).unhover();
    const selectedReport = canvas.querySelector<HTMLElement>(
      '[data-ledger-report-row][data-active="true"]',
    )!;
    const inactiveReport = canvas.querySelector<HTMLElement>(
      '[data-ledger-report-row][data-active="false"]',
    )!;
    const selectedBackground = getComputedStyle(selectedReport).backgroundColor;
    await page.elementLocator(selectedReport).hover();
    await waitFor(() =>
      expect(getComputedStyle(selectedReport).backgroundColor).toBe(
        selectedBackground,
      ),
    );
    await page.elementLocator(selectedReport).unhover();
    const inactiveBackground = getComputedStyle(inactiveReport).backgroundColor;
    await page.elementLocator(inactiveReport).hover();
    await waitFor(() =>
      expect(getComputedStyle(inactiveReport).backgroundColor).not.toBe(
        inactiveBackground,
      ),
    );
    await page.elementLocator(inactiveReport).unhover();
  }
  const { Story } = defineMeta({
    title: "Beancount/Navigation",
    component: BeancountApplication,
    parameters: { beancountApplication: true },
  });
</script>

<Story
  name="Modes and trees"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Financial dashboard" });
    await expectSelectedChoice(
      canvasElement,
      "[data-sidebar-mode]",
      "workspace",
    );
    await expectSelectedChoice(
      canvasElement,
      "[data-workspace-view]",
      "ledgers",
    );
    const fileRow = canvasElement.querySelector<HTMLElement>(
      "[data-ledger-file-row]",
    )!;
    expect(getComputedStyle(fileRow).paddingLeft).toBe("0px");
    expect(fileRow.getBoundingClientRect().height).toBe(32);
    await expectTreePresentation(canvasElement);
    const ledgerSearch = canvas.getByRole("textbox", {
      name: "Search ledgers",
    });
    expect(
      ledgerSearch.parentElement!.querySelector("svg")!.getBoundingClientRect()
        .width,
    ).toBe(14);
    expect(getComputedStyle(ledgerSearch).backgroundColor).toBe(
      getComputedStyle(
        canvasElement.querySelector<HTMLElement>(
          ".ui-minimal-app-shell__main",
        )!,
      ).backgroundColor,
    );
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Search ledgers" }),
      "nonexistent",
    );
    await expect(
      canvas.getByText("No ledgers match the current filter."),
    ).toBeVisible();
    await userEvent.clear(
      canvas.getByRole("textbox", { name: "Search ledgers" }),
    );
    await userEvent.click(canvas.getByRole("radio", { name: "Folders" }));
    await expectSelectedChoice(
      canvasElement,
      "[data-workspace-view]",
      "folders",
    );
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Search folders" }),
      "archive",
    );
    const folderDisclosure = canvas.getByRole("button", {
      name: /all filesystem folders/,
    });
    if (import.meta.env.MODE === "test") {
      const { page } = await import("vitest/browser");
      const background = getComputedStyle(folderDisclosure).backgroundColor;
      await page.elementLocator(folderDisclosure).hover();
      await waitFor(() =>
        expect(getComputedStyle(folderDisclosure).backgroundColor).not.toBe(
          background,
        ),
      );
      await page.elementLocator(folderDisclosure).unhover();
    }
    const folder = canvasElement.querySelector<HTMLElement>(
      '[data-ledger-folder-row="archive"]',
    )!;
    await userEvent.click(folder);
    expect(getComputedStyle(folder.parentElement!).rowGap).toBe("4px");
    expect(
      getComputedStyle(
        folder.parentElement!.querySelector<HTMLElement>(
          "[data-ledger-folder-children]",
        )!,
      ).rowGap,
    ).toBe("4px");
    const folderIcon = folder.querySelectorAll("svg")[1];
    const fileIcon = folder.parentElement!.querySelector(
      "[data-ledger-file-row] svg",
    )!;
    expect(
      Math.abs(
        folderIcon.getBoundingClientRect().left -
          fileIcon.getBoundingClientRect().left,
      ),
    ).toBeLessThanOrEqual(1);
    await userEvent.click(
      canvas.getByRole("button", { name: "Archive Ledger" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Collapse Archive Ledger" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("radio", { name: "Tags" }));
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Search tags" }),
      "household",
    );
    // The disclosure occupies one 14px tree step. Compare rendered hashes,
    // rather than preserving the reference's oversized parent control.
    const tagRoot = canvasElement.querySelector<HTMLElement>(
      '[data-ledger-tag-node="household"]',
    )!;
    const tagRow = tagRoot.querySelector<HTMLElement>("[data-ledger-tag-row]")!;
    const childRow = tagRoot.querySelector<HTMLElement>(
      "[data-ledger-tag-children] [data-ledger-tag-row]",
    )!;
    expect(getComputedStyle(tagRoot).rowGap).toBe("4px");
    expect(
      getComputedStyle(
        tagRoot.querySelector<HTMLElement>("[data-ledger-tag-children]")!,
      ).rowGap,
    ).toBe("4px");
    expect(
      Math.abs(
        tagRow.getBoundingClientRect().left -
          tagRoot.getBoundingClientRect().left -
          18,
      ),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        childRow.getBoundingClientRect().left -
          tagRoot.getBoundingClientRect().left -
          18,
      ),
    ).toBeLessThanOrEqual(1);
    expect(tagRow.querySelector("svg")!.getBoundingClientRect().width).toBe(16);
    for (const child of tagRoot.querySelectorAll<HTMLElement>(
      "[data-ledger-tag-children] [data-ledger-tag-row]",
    )) {
      expect(
        Math.abs(
          tagRow.querySelector("svg")!.getBoundingClientRect().left -
            child.querySelector("svg")!.getBoundingClientRect().left,
        ),
      ).toBeLessThanOrEqual(1);
    }
    const disclosure = canvas.getByRole("button", {
      name: "Collapse household",
    });
    disclosure.focus();
    await userEvent.keyboard("{Enter}");
    expect(childRow).not.toBeInTheDocument();
    await userEvent.keyboard("{Enter}");
    await expect(
      canvasElement.querySelector('[data-ledger-tag-row="household/food"]'),
    ).toBeVisible();
    const banner = canvasElement.querySelector<HTMLElement>(
      "[data-project-banner]",
    )!;
    expect(getComputedStyle(banner).paddingLeft).toBe("8px");
    expect(
      banner
        .querySelector(".beancount-project-banner__mark")!
        .getBoundingClientRect().width,
    ).toBe(32);
    await userEvent.click(
      canvasElement.querySelector<HTMLElement>(
        '[data-ledger-tag-row="household"]',
      )!,
    );
    await expect(
      await canvas.findByRole("button", { name: "Remove #household filter" }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Clear tag filters" }),
    );
    const searchMode = canvas.getByRole("radio", { name: "Search" });
    searchMode.focus();
    await userEvent.keyboard("{Enter}");
    await expectSelectedChoice(canvasElement, "[data-sidebar-mode]", "search");
    await expect(
      canvas.getByRole("searchbox", { name: "Search ledger" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("radio", { name: "Workspace" }));
    await expect(
      canvas.getByRole("textbox", { name: "Search tags" }),
    ).toHaveValue("household");
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<ApplicationHarness
      scenario="review"
      displayMode="desktop"
    />{/snippet}
</Story>

<Story
  name="Settings return and account picker"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Financial dashboard" });
    await userEvent.click(canvas.getByRole("button", { name: "Journal" }));
    await canvas.findByRole("radio", { name: "Transactions" });
    await userEvent.click(
      canvas.getByRole("button", { name: "Project settings" }),
    );
    const settings = within(
      await canvas.findByRole("navigation", { name: "Ledger settings" }),
    );
    await expect(
      settings.getByRole("button", { name: "Accounts" }),
    ).toHaveAttribute("aria-current", "page");
    if (import.meta.env.MODE === "test") {
      const { page } = await import("vitest/browser");
      const selected = settings.getByRole("button", { name: "Accounts" });
      const inactive = settings.getByRole("button", { name: "Merchants" });
      const selectedBackground = getComputedStyle(selected).backgroundColor;
      await page.elementLocator(selected).hover();
      await waitFor(() =>
        expect(getComputedStyle(selected).backgroundColor).toBe(
          selectedBackground,
        ),
      );
      await page.elementLocator(selected).unhover();
      const inactiveBackground = getComputedStyle(inactive).backgroundColor;
      await page.elementLocator(inactive).hover();
      await waitFor(() =>
        expect(getComputedStyle(inactive).backgroundColor).not.toBe(
          inactiveBackground,
        ),
      );
      await page.elementLocator(inactive).unhover();
    }
    const disclosure = settings.getByRole("button", {
      name: "Collapse import navigation",
    });
    const groupLabel = settings.getByRole("button", { name: "Bank Sync" });
    const d = disclosure.getBoundingClientRect();
    const g = groupLabel.getBoundingClientRect();
    expect(d.width).toBe(24);
    expect(d.height).toBe(24);
    expect(
      Math.abs(d.top + d.height / 2 - g.top - g.height / 2),
    ).toBeLessThanOrEqual(1);
    await userEvent.click(disclosure);
    await expect(
      settings.queryByRole("button", { name: "History" }),
    ).not.toBeInTheDocument();
    await expect(
      settings.getByRole("button", { name: "Accounts" }),
    ).toHaveAttribute("aria-current", "page");
    await userEvent.click(
      settings.getByRole("button", { name: "Expand import navigation" }),
    );
    await userEvent.click(settings.getByRole("button", { name: "History" }));
    await canvas.findByRole("region", { name: "Import History" });
    await userEvent.click(
      settings.getByRole("button", { name: "Back to ledger navigation" }),
    );
    await expect(
      await canvas.findByRole("region", { name: "Journal" }),
    ).toBeVisible();
    const nav = within(
      canvas.getByRole("navigation", { name: "Ledger reports" }),
    );
    await expect(
      nav.queryByRole("button", { name: "Accounts" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      nav.getByRole("button", { name: /^Select account:/ }),
    );
    const accountOption = await within(document.body).findByRole("option", {
      name: "Assets:Checking",
    });
    const accountAvatar = accountOption.querySelector("img")!;
    await expect(accountAvatar).toBeVisible();
    expect(accountAvatar.getAttribute("src")).toContain("data:image/svg+xml,");
    await userEvent.click(
      await within(document.body).findByRole("option", {
        name: "All accounts",
      }),
    );
    await expect(
      await canvas.findByRole("region", { name: "Accounts" }),
    ).toBeVisible();
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<ApplicationHarness
      scenario="review"
      displayMode="desktop"
    />{/snippet}
</Story>

<Story
  name="Project opening"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("heading", { name: "Financial dashboard" });
    await userEvent.click(canvas.getByRole("radio", { name: "Projects" }));
    await expectSelectedChoice(
      canvasElement,
      "[data-sidebar-mode]",
      "projects",
    );
    const projectRow = canvasElement.querySelector<HTMLElement>(
      "[data-sidebar-project]",
    )!;
    expect(getComputedStyle(projectRow).paddingLeft).toBe("8px");
    expect(getComputedStyle(projectRow).justifyContent).toBe("flex-start");
    expect(getComputedStyle(projectRow).fontSize).toBe("12px");
    expect(getComputedStyle(projectRow).lineHeight).toBe("16px");
    expect(getComputedStyle(projectRow.parentElement!).rowGap).toBe("4px");
    await userEvent.click(
      canvas.getByRole("button", { name: "Open another project" }),
    );
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Project path" }),
      "error",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Open project" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "could not be opened",
    );
    await expect(
      canvas.getByRole("heading", { name: "Financial dashboard" }),
    ).toBeVisible();
    await userEvent.clear(
      canvas.getByRole("textbox", { name: "Project path" }),
    );
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Project path" }),
      "cancel",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Open project" }));
    await waitFor(() =>
      expect(canvas.queryByRole("alert")).not.toBeInTheDocument(),
    );
    await expect(
      canvas.getByText("Review Project", { selector: "[data-project-name]" }),
    ).toBeVisible();
    await userEvent.clear(
      canvas.getByRole("textbox", { name: "Project path" }),
    );
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Project path" }),
      "Opened books",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Open project" }));
    await expect(
      await canvas.findByText("Opened books", {
        exact: true,
        selector: "[data-project-name]",
      }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await expect(
      await canvas.findByText("Review Project", {
        exact: true,
        selector: "[data-project-name]",
      }),
    ).toBeVisible();
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<ApplicationHarness
      scenario="review"
      displayMode="desktop"
    />{/snippet}
</Story>

<Story
  name="Dark tree styling"
  globals={{ theme: "default", colorMode: "dark" }}
  play={async ({ canvasElement }) => {
    await within(canvasElement).findByRole("heading", {
      name: "Financial dashboard",
    });
    await expectTreePresentation(canvasElement);
  }}
>
  {#snippet template()}<ApplicationHarness
      scenario="review"
      displayMode="desktop"
    />{/snippet}
</Story>

<Story
  name="Settings search and toolbar"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByRole("searchbox", {
      name: "Search merchants",
    });
    await waitFor(() => {
      const wrapper = input.closest<HTMLElement>(".cv-search-filter-input")!;
      const content = wrapper.closest<HTMLElement>(
        ".cv-search-filter-bar__content",
      )!;
      expect(
        Math.abs(
          wrapper.getBoundingClientRect().width -
            content.getBoundingClientRect().width,
        ),
      ).toBeLessThanOrEqual(1);
      expect(wrapper.getBoundingClientRect().width).toBeGreaterThan(300);
    });
    const toolbar = canvasElement.querySelector<HTMLElement>(
      '[data-ui-part="toolbar"]',
    )!;
    for (const button of toolbar.querySelectorAll<HTMLElement>(
      '[data-ui-component="button"]',
    )) {
      expect(button.getBoundingClientRect().height).toBe(32);
    }
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<ApplicationHarness
      scenario="review"
      displayMode="desktop"
      initialRoute="/import/manage-merchants"
    />{/snippet}
</Story>
