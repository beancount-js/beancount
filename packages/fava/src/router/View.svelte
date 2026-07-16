<svelte:options runes={false} />

<script lang="ts">
  import { afterUpdate } from "svelte";
  import RouteLoadingSkeleton from "../components/skeletons/RouteLoadingSkeleton.svelte";
  import { useNavigation } from "./router";

  const { activeRoute, router } = useNavigation();
  const { navigating } = router;

  afterUpdate(() => {
    setTimeout(() => navigating.set(null));
  });
</script>

{#if $activeRoute.element}
  {#key $activeRoute.path}
    <svelte:component this={$activeRoute.element} {...$activeRoute.params} />
  {/key}
{:else if $navigating}
  <RouteLoadingSkeleton />
{/if}
