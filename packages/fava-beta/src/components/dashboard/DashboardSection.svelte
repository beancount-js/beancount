<script lang="ts">
  import { ChevronDown } from "lucide-svelte";

  export let title: string;
  export let eyebrow = "";
  export let expanded = true;
  export let id: string;

  function toggle() {
    expanded = !expanded;
  }
</script>

<section
  class="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
>
  <button
    class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/45"
    aria-controls={id}
    aria-expanded={expanded}
    on:click={toggle}
  >
    <span>
      {#if eyebrow}
        <span
          class="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          {eyebrow}
        </span>
      {/if}
      <span class="text-base font-semibold text-foreground">{title}</span>
    </span>
    <ChevronDown
      class={`size-4 text-muted-foreground transition-transform ${!expanded ? "rotate-180" : ""}`}
      aria-hidden="true"
    />
  </button>
  {#if expanded}
    <div {id} class="border-t border-border/80">
      <slot />
    </div>
  {/if}
</section>
