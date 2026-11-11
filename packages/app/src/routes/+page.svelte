<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy, untrack } from "svelte";
  import { BeancountApplication } from "@beancount-js/ui";
  import { createBeancountController } from "@beancount-js/ui/controller";
  import {
    createBrowserBeancountDataSource,
    createHttpBeancountDataSource,
  } from "$lib/data-source";

  const runtime = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME;
  const controller = untrack(() =>
    createBeancountController({
      source:
        runtime === "web"
          ? createBrowserBeancountDataSource()
          : createHttpBeancountDataSource(),
    }),
  );

  onDestroy(() => controller.dispose());
</script>

<BeancountApplication
  {controller}
  layoutStorage={browser ? localStorage : undefined}
/>
