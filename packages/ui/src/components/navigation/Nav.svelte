<script lang="ts">
  import type { Icon } from "lucide-svelte";
  import SidebarNavigation, {
    type SidebarNavigationItem,
  } from "./SidebarNavigation.svelte";

  export type NavItem = {
    name: string;
    path: string;
    badge?: string;
    icon: typeof Icon;
  };

  let {
    items,
    activeHref,
    ariaLabel = "App navigation",
    onNavigate,
  }: {
    items: readonly NavItem[];
    activeHref?: string;
    ariaLabel?: string;
    onNavigate?: (path: string) => void;
  } = $props();

  const mapItems = (rawItems: readonly NavItem[]): SidebarNavigationItem[] =>
    rawItems.map((item) => ({
      label: item.name,
      href: item.path,
      icon: item.icon,
      badge: item.badge,
    }));
</script>

<SidebarNavigation
  items={mapItems(items)}
  {activeHref}
  {ariaLabel}
  onNavigate={(path: string) => onNavigate?.(path)}
/>
