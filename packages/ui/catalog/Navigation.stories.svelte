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
    });
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
    expect(getComputedStyle(fileRow).paddingLeft).toBe("4px");
    expect(fileRow.getBoundingClientRect().height).toBe(32);
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
    const folder = canvasElement.querySelector<HTMLElement>(
      '[data-ledger-folder-row="archive"]',
    )!;
    await userEvent.click(folder);
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
    // Adapted from the historical tree: a 14px depth step, a 36px
    // parent disclosure and 4px gap. Leaf labels keep their original offset.
    const tagRoot = canvasElement.querySelector<HTMLElement>(
      '[data-ledger-tag-node="household"]',
    )!;
    const tagRow = tagRoot.querySelector<HTMLElement>("[data-ledger-tag-row]")!;
    const childRow = tagRoot.querySelector<HTMLElement>(
      "[data-ledger-tag-children] [data-ledger-tag-row]",
    )!;
    expect(
      Math.abs(
        tagRow.getBoundingClientRect().left -
          tagRoot.getBoundingClientRect().left -
          44,
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
