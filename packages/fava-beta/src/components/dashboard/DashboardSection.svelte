<script lang="ts">
  import type { Snippet } from "svelte";
  import DashboardSection from "@beancount-js/ui/dashboard/DashboardSection.svelte";

  let {
    id,
    title,
    eyebrow,
    expanded = true,
    children,
    onOpenChange = () => {},
  }: {
    id: string;
    title: string;
    eyebrow?: string;
    /** Controlled disclosure state. */
    expanded?: boolean;
    children?: Snippet;
    /** Report disclosure state changes to application-owned state. */
    onOpenChange?: (open: boolean) => void;
  } = $props();

  let open = $state(expanded);

  $effect(() => {
    open = expanded;
  });

  function handleOpenChange(nextOpen: boolean) {
    open = nextOpen;
    onOpenChange(nextOpen);
  }
</script>

<DashboardSection
  {id}
  {title}
  {eyebrow}
  {open}
  onOpenChange={handleOpenChange}
>
  {@render children?.()}
</DashboardSection>
