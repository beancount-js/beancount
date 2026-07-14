<script lang="ts">
  import "./studio.css";

  let { children } = $props();
</script>

<svelte:head><title>Beancount Studio</title></svelte:head>
{@render children()}
