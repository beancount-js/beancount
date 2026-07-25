<script lang="ts">
  import "@lapis/ui/styles.css";
  import { ModeWatcher } from "mode-watcher";
  import "../style.scss";

  let { children } = $props();
</script>

<svelte:head><title>Beancount Studio</title></svelte:head>
<ModeWatcher />
{@render children()}
