<script lang="ts">
  import { afterUpdate } from "svelte";
  import { useNavigation } from "./router";

  const { activeRoute, router } = useNavigation();
  const { navigating } = router;

  afterUpdate(() => {
    setTimeout(() => navigating.set(null));
  });
</script>

{#if $navigating}
  <p>Loading...</p>
{/if}
{#if $activeRoute.element}
  {#key $activeRoute.path}
    <svelte:component this={$activeRoute.element} {...$activeRoute.params} />
  {/key}
{/if}
