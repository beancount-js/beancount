<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  import { expectContainedShell } from "./layout-assertions";
  const { Story } = defineMeta({
    title: "Beancount/Query",
    component: BeancountApplication,
    parameters: { beancountApplication: true },
  });
  const initialRoute =
    "/query?qs=" + encodeURIComponent("SELECT account FROM postings LIMIT 2");

  function expectQueryGeometry(canvasElement: HTMLElement) {
    const field = canvasElement.querySelector<HTMLElement>(
      "[data-query-editor]",
    )!;
    const actions = field.querySelector<HTMLElement>("[data-query-actions]")!;
    expect(field.querySelector(".cm-gutters")).toBeNull();
    expect(field.scrollWidth).toBeLessThanOrEqual(field.clientWidth + 1);
    const f = field.getBoundingClientRect();
    const a = actions.getBoundingClientRect();
    expect(Math.abs(f.right - a.right - 5)).toBeLessThanOrEqual(1);
    expect(Math.abs(f.bottom - a.bottom - 5)).toBeLessThanOrEqual(1);
    for (const button of actions.querySelectorAll("button")) {
      expect(button.getBoundingClientRect().height).toBe(28);
    }
    expect(
      field.querySelector(".cm-code-editor")!.getBoundingClientRect().right,
    ).toBeLessThanOrEqual(a.left + 1);
  }

  async function queryInteractions({
    canvasElement,
  }: {
    canvasElement: HTMLElement;
  }) {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", { name: "BQL query" });
    await canvas.findByRole("button", { name: /^Copy query:/ });
    expectQueryGeometry(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Clear query" }));
    await waitFor(() =>
      expect(editor.querySelector(".cm-placeholder")).toBeVisible(),
    );
    expect(canvas.queryByRole("button", { name: "Clear query" })).toBeNull();
    expect(
      canvasElement
        .querySelector("[data-query-editor]")!
        .getBoundingClientRect().height,
    ).toBeLessThanOrEqual(40);

    await userEvent.type(editor, "se");
    await waitFor(() => {
      const completion = canvasElement.querySelector(
        ".cm-tooltip-autocomplete",
      )!;
      expect(completion).toBeVisible();
      expect(completion).toHaveTextContent("select");
      expect(
        parseFloat(getComputedStyle(completion).borderRadius),
      ).toBeGreaterThan(0);
    });
    await userEvent.click(canvas.getByRole("button", { name: "Clear query" }));

    await userEvent.type(
      editor,
      "SELECT account, number FROM postings LIMIT 3",
    );
    await userEvent.click(canvas.getByRole("button", { name: "Format query" }));
    await waitFor(() =>
      expect(
        [...editor.querySelectorAll(".cm-line")].map(
          (line) => line.textContent,
        ),
      ).toEqual([
        "SELECT",
        "  account,",
        "  number",
        "FROM",
        "  postings",
        "LIMIT",
        "  3",
      ]),
    );
    expectQueryGeometry(canvasElement);
    const keyword = editor.querySelector<HTMLElement>(".cm-keyword")!;
    expect(keyword).toBeVisible();
    expect(getComputedStyle(keyword).color).not.toBe(
      getComputedStyle(editor).color,
    );
    await userEvent.click(canvas.getByRole("button", { name: "Execute" }));
    await waitFor(() => {
      expect(editor.querySelector(".cm-placeholder")).toBeVisible();
      expect(
        canvasElement.querySelectorAll("[data-query-history-item]"),
      ).toHaveLength(2);
    });
    const saved = canvasElement.querySelector<HTMLElement>(
      "[data-query-history-item]",
    )!;
    const header = saved.querySelector<HTMLElement>(
      "[data-query-history-header]",
    )!;
    expect(header.getBoundingClientRect().height).toBeGreaterThanOrEqual(56);
    expect(
      parseFloat(getComputedStyle(saved).borderTopLeftRadius),
    ).toBeGreaterThan(0);
    expect(saved.querySelector("[data-query-history-label]")).toHaveTextContent(
      "number",
    );
    const resultBody = saved.querySelector<HTMLElement>(
      "[data-query-history-results]",
    )!;
    expect(getComputedStyle(resultBody).paddingLeft).toBe("16px");
    expect(getComputedStyle(resultBody).paddingRight).toBe("16px");
    expect(getComputedStyle(resultBody).paddingBottom).toBe("16px");
    const trigger = saved.querySelector<HTMLElement>(
      "[data-query-history-trigger]",
    )!;
    const indicator = [
      ...trigger.querySelectorAll('[data-slot="accordion-trigger-icon"]'),
    ].find((icon) => icon.getBoundingClientRect().width > 0)!;
    expect(
      indicator.getBoundingClientRect().left -
        trigger.getBoundingClientRect().left,
    ).toBeGreaterThanOrEqual(12);
    expect(
      indicator.getBoundingClientRect().left -
        trigger.getBoundingClientRect().left,
    ).toBeLessThanOrEqual(20);
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await expect(trigger).toHaveAttribute("data-state", "closed");
    await userEvent.keyboard("{Enter}");
    await expect(trigger).toHaveAttribute("data-state", "open");
    // Reusing the currently submitted query must still refill a cleared draft.
    await userEvent.click(
      within(saved).getByRole("button", { name: /^Copy query:/ }),
    );
    await waitFor(() =>
      expect(
        [...editor.querySelectorAll(".cm-line")]
          .map((line) => line.textContent)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      ).toBe("SELECT account, number FROM postings LIMIT 3"),
    );
    expect(
      canvasElement.querySelectorAll("[data-query-history-item]"),
    ).toHaveLength(2);
    await userEvent.click(canvas.getByRole("button", { name: "Clear query" }));
    await userEvent.click(
      within(saved).getByRole("button", { name: /^Delete query:/ }),
    );
    expect(
      canvasElement.querySelectorAll("[data-query-history-item]"),
    ).toHaveLength(1);
    await userEvent.type(editor, "SELECT account FROM postings LIMIT 1");
    const modifier = /Mac/.test(navigator.platform) ? "Meta" : "Control";
    await userEvent.keyboard(`{${modifier}>}{Enter}{/${modifier}}`);
    await waitFor(() =>
      expect(editor.querySelector(".cm-placeholder")).toBeVisible(),
    );
    expect(
      canvasElement.querySelectorAll("[data-query-history-item]"),
    ).toHaveLength(2);
    await userEvent.click(canvas.getByRole("button", { name: "Dashboard" }));
    await canvas.findByRole("heading", { name: "Financial dashboard" });
    await userEvent.click(canvas.getByRole("button", { name: "Back" }));
    await canvas.findByRole("textbox", { name: "BQL query" });
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll("[data-query-history-item]"),
      ).toHaveLength(2),
    );
    await expectContainedShell(canvasElement);
  }
</script>

<Story name="Editor and history" play={queryInteractions}>
  {#snippet template()}<ApplicationHarness
      {initialRoute}
      displayMode="desktop"
    />{/snippet}
</Story>
<Story
  name="Dark editor and history"
  globals={{ colorMode: "dark" }}
  play={queryInteractions}
>
  {#snippet template()}<ApplicationHarness
      {initialRoute}
      displayMode="desktop"
    />{/snippet}
</Story>
<Story
  name="Mobile editor"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("textbox", { name: "BQL query" });
    expectQueryGeometry(canvasElement);
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<div style="width: 390px; max-width: 100%; height: 100%">
      <ApplicationHarness {initialRoute} displayMode="mobile" />
    </div>{/snippet}
</Story>
