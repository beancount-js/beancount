<script lang="ts">
  import "@beancount-js/ui/styles.css";
  import { ModeWatcher } from "mode-watcher";

  let { children } = $props();
</script>

<svelte:head><title>Beancount Studio</title></svelte:head>
<ModeWatcher />
{@render children()}
