<script lang="ts">
  import { onDestroy, untrack } from "svelte";
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
  onDestroy(() => controller.dispose());
</script>

<BeancountApplication {controller} {displayMode} />
