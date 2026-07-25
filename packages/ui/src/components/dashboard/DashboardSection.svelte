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

<section class="cn-dashboard-dashboardsection-29-1" data-dashboard-section>
  <button
    type="button"
    class="cn-dashboard-dashboardsection-34-1"
    aria-controls={id}
    aria-expanded={open}
    onclick={toggle}
  >
    <span>
      {#if eyebrow}
        <span class="cn-dashboard-dashboardsection-42-1">
          {eyebrow}
        </span>
      {/if}
      <span class="cn-dashboard-dashboardsection-47-1">{title}</span>
    </span>
    <ChevronDown
      class={`cn-dashboard-dashboardsection-50-2 cn-dashboard-dashboardsection-50-3 cn-dashboard-dashboardsection-50-4 ${!open ? "cn-dashboard-dashboardsection-50-1" : ""}`}
      aria-hidden="true"
    />
  </button>
  {#if open}
    <div {id} class="cn-dashboard-dashboardsection-55-1">
      {@render children?.()}
    </div>
  {/if}
</section>
