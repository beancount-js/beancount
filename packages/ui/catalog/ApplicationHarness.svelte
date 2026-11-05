<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import { BeancountApplication } from "@beancount-js/ui";
  import {
    createInMemoryBeancountController,
    type CatalogScenario,
  } from "./controller/in-memory-controller";
  import type { AppShellDisplayMode } from "@lapismd/design-core/shell";
  let {
    initialRoute = "/dashboard",
    displayMode = "auto",
    scenario = "ready",
  }: {
    initialRoute?: string;
    displayMode?: AppShellDisplayMode;
    scenario?: CatalogScenario;
  } = $props();
  const controller = untrack(() =>
    createInMemoryBeancountController(initialRoute, scenario),
  );
  onMount(() => {
    if (scenario !== "preview" && scenario !== "review") return;
    void controller
      .initialize()
      .then(() => controller.workspace.refreshReviewLedger())
      .catch(() => undefined);
  });
  onDestroy(() => controller.dispose());
</script>

<BeancountApplication {controller} {displayMode} />
