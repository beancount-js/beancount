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
            "An integrated reference form inside the shared app shell. It demonstrates a toolbar, fixed and editable section headers, nested repeatable rules, add/reorder/remove flows, validation, switches, segmented controls, searchable account pickers, and the authoritative YAML source mode in their intended layout. Use the [Form guidance](?path=/docs/ui-forms-guidance--docs) to choose the primitives.",
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
    const enabledSwitch = canvas.getByRole("switch", {
      name: "Enable ledger",
    });
    await expect(enabledSwitch).toBeChecked();
    await userEvent.click(enabledSwitch);
    await expect(enabledSwitch).not.toBeChecked();

    const syncMode = within(canvas.getByRole("group", { name: "Sync mode" }));
    const manualSync = syncMode.getByRole("button", { name: "Manual" });
    await userEvent.click(manualSync);
    await expect(manualSync).toHaveAttribute("aria-pressed", "true");

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

    const yamlSwitch = canvas.getByRole("switch", {
      name: "Edit ledger source as YAML",
    });
    await expect(yamlSwitch).not.toBeChecked();
    await userEvent.click(yamlSwitch);
    await expect(yamlSwitch).toBeChecked();
    await expect(
      canvas.getByRole("textbox", { name: "Ledger source YAML" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Apply YAML" }));
    await expect(canvas.getByText("YAML source draft applied")).toBeVisible();
  }}
/>
