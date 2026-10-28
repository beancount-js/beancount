<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import {
    expect,
    fireEvent,
    userEvent,
    waitFor,
    within,
  } from "storybook/test";
  import { EditorView } from "@codemirror/view";
  import InlineAccountHarness from "./InlineAccountHarness.svelte";
  import { expectContainedShell } from "./layout-assertions";

  const { Story } = defineMeta({
    title: "Beancount/Editing/Inline accounts",
    component: InlineAccountHarness,
    parameters: { beancountApplication: true },
  });

  async function accountControls({
    canvasElement,
  }: {
    canvasElement: HTMLElement;
  }) {
    const canvas = within(canvasElement);
    const editor = await canvas.findByRole("textbox", {
      name: "Ledger source",
    });
    const view = EditorView.findFromDOM(editor)!;
    await editor.ownerDocument.fonts.ready;
    const lineHeight = editor
      .querySelector(".cm-line")!
      .getBoundingClientRect().height;
    async function select(account: string) {
      const from = view.state.doc.toString().lastIndexOf(account);
      view.dispatch({ selection: { anchor: from + account.length } });
      view.focus();
      const button = await within(editor).findByRole("button", {
        name: `Account: ${account}`,
      });
      const control = button.closest<HTMLElement>("[data-inline-account]")!;
      const avatar = control.querySelector<HTMLElement>(
        ".beancount-account-avatar",
      )!;
      expect(avatar.getBoundingClientRect().width).toBe(16);
      expect(avatar.getBoundingClientRect().height).toBe(16);
      expect(button.getBoundingClientRect().height).toBe(16);
      expect(
        button.closest(".cm-line")!.getBoundingClientRect().height,
      ).toBeCloseTo(lineHeight, 1);
      return { from, button, avatar };
    }
    const bank = await select("Assets:Checking");
    await expect(bank.avatar.querySelector("svg")).toBeVisible();
    expect(bank.avatar.style.getPropertyValue("--account-avatar-color")).toBe(
      "#0284C7",
    );
    const savings = await select("Assets:Savings");
    expect(savings.avatar.textContent?.trim()).toBe("S");
    const food = await select("Expenses:Food");
    const logo = await waitFor(() => {
      const image = food.avatar.querySelector("img");
      expect(image).not.toBeNull();
      return image!;
    });
    expect(logo).toHaveAttribute(
      "src",
      expect.stringContaining("data:image/svg+xml,"),
    );
    await fireEvent.error(logo);
    await waitFor(() => expect(food.avatar.textContent?.trim()).toBe("F"));

    // Use a real pointer so the compact control remains usable next to source text.
    if (import.meta.env.MODE === "test") {
      const { page } = await import("vitest/browser");
      await page.elementLocator(food.button).click();
    } else await userEvent.click(food.button);
    const search = await within(document.body).findByPlaceholderText(
      "Filter account...",
    );
    await userEvent.type(search, "Expenses:Rent");
    const before = view.state.doc.toString();
    await userEvent.click(
      await within(document.body).findByRole("option", {
        name: "Expenses:Rent",
      }),
    );
    await waitFor(() =>
      expect(view.state.doc.toString()).toBe(
        before.slice(0, food.from) +
          "Expenses:Rent" +
          before.slice(food.from + "Expenses:Food".length),
      ),
    );
    // Equal-length replacements must update the existing widget's account identity.
    const rent = await select("Expenses:Rent");
    expect(rent.avatar.textContent?.trim()).toBe("R");
    view.focus();
    const modifier = /Mac/.test(navigator.platform) ? "Meta" : "Control";
    await userEvent.keyboard(`{${modifier}>}z{/${modifier}}`);
    await waitFor(() => expect(view.state.doc.toString()).toBe(before));
    await select("Expenses:Food");

    const currency =
      view.state.doc
        .toString()
        .indexOf(
          " GBP",
          view.state.doc.toString().indexOf("open Assets:Checking"),
        ) + 2;
    view.dispatch({ selection: { anchor: currency } });
    await waitFor(() =>
      expect(
        editor.querySelector('[data-node-name="Currency"]'),
      ).not.toBeNull(),
    );
    expect(
      editor.querySelector(
        '[data-node-name="Currency"] .beancount-account-avatar',
      ),
    ).toBeNull();
    view.dispatch({ selection: { anchor: 0 } });
    await expectContainedShell(canvasElement);
  }
</script>

<Story name="Account appearances" play={accountControls} />
<Story
  name="Dark account appearances"
  globals={{ colorMode: "dark" }}
  play={accountControls}
/>
