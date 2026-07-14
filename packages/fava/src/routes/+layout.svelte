<script lang="ts">
  import "@fontsource-variable/dm-sans";
  import { ModeWatcher } from "mode-watcher";
  import "../style.scss";

  let { children } = $props();
</script>

<svelte:head><title>Beancount Studio</title></svelte:head>
<ModeWatcher />
{@render children()}
