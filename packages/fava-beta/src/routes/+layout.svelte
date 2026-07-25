<script lang="ts">
  import "@lapis/ui/reset.css";
  import "@lapis/ui/styles.css";
  import { ModeWatcher } from "mode-watcher";
  import "../style.scss";
  import "../styles/beta-native.css";

  let { children } = $props();
</script>

<svelte:head><title>Beancount Studio</title></svelte:head>
<ModeWatcher />
{@render children()}
