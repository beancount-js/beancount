<script lang="ts">
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import type { Snippet } from "svelte";

  let {
    id,
    title,
    eyebrow,
    open = $bindable(true),
    children,
    onOpenChange = () => {},
  }: {
    id: string;
    title: string;
    eyebrow?: string;
    /** Controlled disclosure state; the parent may persist dashboard preferences. */
    open?: boolean;
    children?: Snippet;
    onOpenChange?: (open: boolean) => void;
  } = $props();

  function toggle() {
    open = !open;
    onOpenChange(open);
  }
</script>

<section
  class="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
  data-dashboard-section
>
  <button
    type="button"
    class="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    aria-controls={id}
    aria-expanded={open}
    onclick={toggle}
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
      class={`size-4 text-muted-foreground transition-transform ${!open ? "rotate-180" : ""}`}
      aria-hidden="true"
    />
  </button>
  {#if open}
    <div {id} class="border-t border-border/80">
      {@render children?.()}
    </div>
  {/if}
</section>
