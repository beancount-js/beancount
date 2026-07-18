<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import FormWorkspaceDemo from "./FormWorkspaceDemo.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Form Workspace",
    component: FormWorkspaceDemo,
  });
</script>

<Story
  name="Editable ledger settings"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Collapse all" }));
    await expect(
      canvas.getByRole("button", { name: "Expand all" }),
    ).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Expand all" }));
    await userEvent.click(canvas.getByRole("button", { name: "Add source" }));
    await expect(canvas.getByText("3 sources")).toBeVisible();
  }}
/>
