<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import FormWorkspaceDemo from "./FormWorkspaceDemo.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Form Workspace",
    component: FormWorkspaceDemo,
    parameters: {
      docs: {
        description: {
          component:
            "An integrated reference form inside the shared app shell. It demonstrates a toolbar, fixed and editable section headers, nested repeatable rules, add/reorder/remove flows, validation, segmented controls, and searchable account pickers in their intended layout.",
        },
      },
    },
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
    const sourceName = canvas.getByRole("textbox", {
      name: "Main card source name",
    });
    await userEvent.clear(sourceName);
    await userEvent.type(sourceName, "Primary card");
    await expect(sourceName).toHaveValue("Primary card");

    const primaryCard = canvas.getByRole("region", {
      name: "Primary card source",
    });
    const primaryCardCanvas = within(primaryCard);
    await userEvent.click(
      primaryCardCanvas.getByRole("button", { name: "Add rule" }),
    );
    await expect(primaryCardCanvas.getByText("Rule 2")).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "Add source" }));
    await expect(canvas.getByText("3 sources")).toBeVisible();
  }}
/>
