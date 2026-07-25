<script lang="ts">
  export let pageTitle: string;

  /**
   * Use `container` when embedding the shell in a bounded parent, such as its
   * Storybook preview. Applications retain the viewport-height default.
   */
  export let height: "viewport" | "container" = "viewport";

  /**
   * A shell with a persistent sidebar lets the workspace align directly to it.
   * Sidebar-free views retain the same gutter on both sides of the workspace.
   */
  export let hasSidebar = false;
</script>

<div
  data-slot="app-shell"
  class={`cn-root-appshell-19-4 ${height === "viewport" ? "cn-root-appshell-19-2" : "cn-root-appshell-19-1"} cn-root-appshell-19-7 cn-root-appshell-19-5 cn-root-appshell-19-3 cn-root-appshell-19-6`}
>
  <slot name="sidebar"></slot>
  <div
    data-slot="studio-workspace-shell"
    class={`cn-root-appshell-24-2 cn-root-appshell-24-5 cn-root-appshell-24-3 cn-root-appshell-24-4 cn-root-appshell-24-6 ${hasSidebar ? "cn-root-appshell-24-1" : ""}`}
  >
    <main class="cn-root-appshell-27-1">
      <header data-slot="studio-workspace-header" class="cn-root-appshell-31-1">
        <slot name="mobile-navigation-trigger"></slot>
        <slot name="desktop-sidebar-trigger"></slot>
        <span data-workspace-page-title class="cn-root-appshell-37-1">
          {pageTitle}
        </span>
        <slot name="title-trailing"></slot>
        <slot name="header-leading"></slot>
        <div class="cn-root-appshell-44-1">
          <slot name="header-actions"></slot>
        </div>
      </header>
      <slot name="status"></slot>
      <div class="cn-root-appshell-50-1">
        <slot></slot>
      </div>
    </main>
    <slot name="ai"></slot>
  </div>
</div>
