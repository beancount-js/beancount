<script lang="ts">
  import { afterUpdate } from "svelte";
  import { useNavigation } from "./router";
  const {
    router: { activeRoute, navigating },
  } = useNavigation();
  afterUpdate(() => {
    setTimeout(() => navigating.set(null));
  });
</script>

{#if $navigating}
  <p>Loading...</p>
{/if}
<svelte:component this={$activeRoute.element} {...$activeRoute.params} />
