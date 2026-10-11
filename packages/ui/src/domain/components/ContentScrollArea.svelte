<script lang="ts">
  import type { Snippet } from "svelte";
  let {
    class: className = "",
    contentClass = "",
    children,
  }: { class?: string; contentClass?: string; children?: Snippet } = $props();
</script>

<div
  data-content-scroll-area
  class={[className, contentClass].filter(Boolean).join(" ")}
>
  {@render children?.()}
</div>
