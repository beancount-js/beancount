<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import AccountProfileForm from "../src/components/forms/AccountProfileForm.svelte";
  const { Story } = defineMeta({
    title: "Beancount/Forms/Account profile",
    component: AccountProfileForm,
    args: {
      value: {
        account: "Assets:Bank",
        description: "Current account",
        color: "#7667D9",
        tags: ["bank"],
        hidden: false,
      },
      onSave: async () => {},
    },
  });
</script>

<Story
  name="Edit and save"
  play={async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: /^Account$/ });
    await userEvent.clear(input);
    await userEvent.type(input, "invalid");
    await userEvent.click(canvas.getByRole("button", { name: "Save account" }));
    await expect(
      await canvas.findByText("Use a Beancount account such as Assets:Bank."),
    ).toBeVisible();
    await userEvent.clear(input);
    await userEvent.type(input, "Assets:Savings");
    await userEvent.click(canvas.getByRole("button", { name: "Save account" }));
    await expect(await canvas.findByText("Account saved")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Collapse all" }));
    await expect(input).not.toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Expand all" }));
    await expect(
      canvas.getByRole("textbox", { name: /^Account$/ }),
    ).toBeVisible();
    await expect(canvasElement.scrollWidth).toBeLessThanOrEqual(
      canvasElement.clientWidth,
    );
  }}
/>
