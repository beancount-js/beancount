<script lang="ts">
  import "../style.scss";

  let { children } = $props();
</script>

<svelte:head><title>Beancount Studio</title></svelte:head>
{@render children()}
