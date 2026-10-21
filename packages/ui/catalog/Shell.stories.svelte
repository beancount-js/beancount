<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { within } from "storybook/test";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import ApplicationHarness from "./ApplicationHarness.svelte";
  import { expectHeaderActionsRight } from "./header-assertions";
  import { expectContainedShell } from "./layout-assertions";
  const { Story } = defineMeta({
    title: "Beancount/Shell",
    component: BeancountApplication,
    parameters: { beancountApplication: true },
  });
</script>

<Story
  name="Mobile header actions"
  play={async ({ canvasElement }) => {
    await within(canvasElement).findByRole("region", { name: "Sources" });
    await expectHeaderActionsRight(canvasElement);
    await expectContainedShell(canvasElement);
  }}
>
  {#snippet template()}<div style="width: 390px; max-width: 100%; height: 100%">
      <ApplicationHarness initialRoute="/import/editor" displayMode="mobile" />
    </div>{/snippet}
</Story>
