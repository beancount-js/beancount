<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import BeancountApplication from "../src/components/application/BeancountApplication.svelte";
  import { createInMemoryBeancountController } from "./controller/in-memory-controller";
  import type { AppShellDisplayMode } from "@lapismd/design-core/shell";
  let {
    initialRoute = "/dashboard",
    displayMode = "auto",
  }: { initialRoute?: string; displayMode?: AppShellDisplayMode } = $props();
  const controller = untrack(() =>
    createInMemoryBeancountController(initialRoute),
  );
  onDestroy(() => controller.dispose());
</script>

<BeancountApplication {controller} {displayMode} />
