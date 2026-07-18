<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import AppShellDemo from "./AppShellDemo.svelte";

  const { Story } = defineMeta({
    title: "Layout/App Shell",
    component: AppShellDemo,
  });
</script>

<Story
  name="Ledger workspace"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Accounts" }));
    await expect(
      canvas.getByRole("heading", { name: "Accounts" }),
    ).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Sync ledger" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Syncing Barclays checking account…",
    );
  }}
/>
