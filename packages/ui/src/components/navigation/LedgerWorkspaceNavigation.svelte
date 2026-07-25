<script lang="ts">
  import type { Icon } from "lucide-svelte";
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import FileText from "lucide-svelte/icons/file-text";
  import FolderTree from "lucide-svelte/icons/folder-tree";
  import Hash from "lucide-svelte/icons/hash";
  import List from "lucide-svelte/icons/list";
  import ListFilter from "lucide-svelte/icons/list-filter";
  import SearchIcon from "lucide-svelte/icons/search";
  import Sparkles from "lucide-svelte/icons/sparkles";
  import { Button } from "../shadcn/button";
  import { Input } from "../shadcn/input";
  import FilterCommandPicker from "../forms/FilterCommandPicker.svelte";
  import type { FilterCommandOption } from "../forms/picker-options";
  import WorkspaceTreeNavigation, {
    type WorkspaceTreeNavigationItem,
  } from "./WorkspaceTreeNavigation.svelte";

  export type LedgerWorkspaceView = "ledgers" | "folders" | "tags";
  export type LedgerTagsPresentation = "tree" | "flat";

  /** A display-ready action such as an attached receipt or saved resource. */
  export type LedgerWorkspaceResource = {
    id: string;
    label: string;
    icon?: typeof Icon;
    disabled?: boolean;
  };

  /** A controlled searchable picker shown below a ledger tree. */
  export type LedgerWorkspacePicker = {
    label: string;
    value: string;
    options: readonly FilterCommandOption[];
    ariaLabel?: string;
    placeholder?: string;
  };

  /**
   * The reusable visual part of a multi-ledger workspace sidebar.
   *
   * Map application files, folders, tags, routes, and persisted expansion
   * state into these display-ready models. Routing, filtering from domain data,
   * storage, and picker query execution remain in the application adapter.
   */
  let {
    ledgerItems,
    folderItems = [],
    tagItems = [],
    title = "Ledgers",
    ledgerCount = ledgerItems.length,
    view = "ledgers",
    searchOpen = false,
    treeVariant = "default",
    tagsPresentation = "tree",
    activeLedgerId,
    ledgerExpandedIds = [],
    folderExpandedIds = [],
    tagExpandedIds = [],
    selectedTagIds = [],
    queryPicker,
    accountPicker,
    resources = [],
    ariaLabel = "Ledger workspace navigation",
    onViewChange,
    onSearchOpenChange,
    onLedgerSelect,
    onLedgerExpandedIdsChange,
    onFolderSelect,
    onFolderExpandedIdsChange,
    onTagSelect,
    onTagExpandedIdsChange,
    onSelectedTagIdsChange,
    onTagsPresentationChange,
    onQueryChange,
    onAccountChange,
    onResourceSelect,
    searchContent,
  }: {
    /** A ledger tree, usually a ledger file with page destinations as children. */
    ledgerItems: readonly WorkspaceTreeNavigationItem[];
    /** A display-ready filesystem tree. */
    folderItems?: readonly WorkspaceTreeNavigationItem[];
    /** A display-ready tag hierarchy. The component supplies a tag icon by default. */
    tagItems?: readonly WorkspaceTreeNavigationItem[];
    title?: string;
    /** Count shown in the compact sidebar heading. */
    ledgerCount?: number;
    view?: LedgerWorkspaceView;
    /** The application owns whether its route-aware search panel is open. */
    searchOpen?: boolean;
    /** Selects a compact visual treatment for a mapped ledger sidebar. */
    treeVariant?: "default" | "ledger";
    tagsPresentation?: LedgerTagsPresentation;
    activeLedgerId?: string;
    ledgerExpandedIds?: readonly string[];
    folderExpandedIds?: readonly string[];
    tagExpandedIds?: readonly string[];
    /** Controlled, multiple tag filters. */
    selectedTagIds?: readonly string[];
    queryPicker?: LedgerWorkspacePicker;
    accountPicker?: LedgerWorkspacePicker;
    resources?: readonly LedgerWorkspaceResource[];
    ariaLabel?: string;
    onViewChange?: (view: LedgerWorkspaceView) => void;
    onSearchOpenChange?: (open: boolean) => void;
    onLedgerSelect?: (id: string) => void;
    onLedgerExpandedIdsChange?: (ids: string[]) => void;
    onFolderSelect?: (id: string) => void;
    onFolderExpandedIdsChange?: (ids: string[]) => void;
    onTagSelect?: (id: string) => void;
    onTagExpandedIdsChange?: (ids: string[]) => void;
    onSelectedTagIdsChange?: (ids: string[]) => void;
    onTagsPresentationChange?: (presentation: LedgerTagsPresentation) => void;
    onQueryChange?: (value: string) => void;
    onAccountChange?: (value: string) => void;
    onResourceSelect?: (id: string) => void;
    /** Application-owned search UI rendered in place of the workspace tree. */
    searchContent?: import("svelte").Snippet;
  } = $props();

  let ledgerSearch = $state("");
  let folderSearch = $state("");
  let tagSearch = $state("");

  const visibleLedgerItems = $derived(filterTree(ledgerItems, ledgerSearch));
  const visibleFolderItems = $derived(filterTree(folderItems, folderSearch));
  const visibleTagItems = $derived(
    addDefaultIcon(filterTree(tagItems, tagSearch), Hash),
  );
  const flatTagItems = $derived(flattenTree(visibleTagItems));
  const selectedTags = $derived(
    selectedTagIds
      .map((id) => findItem(tagItems, id))
      .filter((item): item is WorkspaceTreeNavigationItem => Boolean(item)),
  );
  const visibleLedgerExpandableIds = $derived(
    expandableItemIds(visibleLedgerItems),
  );
  const visibleFolderExpandableIds = $derived(
    expandableItemIds(visibleFolderItems),
  );

  function filterTree(
    items: readonly WorkspaceTreeNavigationItem[],
    query: string,
  ): readonly WorkspaceTreeNavigationItem[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return items;

    return items.flatMap((item) => {
      const children = filterTree(item.children ?? [], query);
      if (
        item.label.toLocaleLowerCase().includes(normalizedQuery) ||
        children.length
      ) {
        return [{ ...item, children }];
      }
      return [];
    });
  }

  function addDefaultIcon(
    items: readonly WorkspaceTreeNavigationItem[],
    icon: typeof Icon,
  ): readonly WorkspaceTreeNavigationItem[] {
    return items.map((item) => ({
      ...item,
      icon: item.icon ?? icon,
      children: addDefaultIcon(item.children ?? [], icon),
    }));
  }

  function flattenTree(
    items: readonly WorkspaceTreeNavigationItem[],
  ): WorkspaceTreeNavigationItem[] {
    return items.flatMap((item) => [item, ...flattenTree(item.children ?? [])]);
  }

  function findItem(
    items: readonly WorkspaceTreeNavigationItem[],
    id: string,
  ): WorkspaceTreeNavigationItem | undefined {
    for (const item of items) {
      if (item.id === id) return item;
      const child = findItem(item.children ?? [], id);
      if (child) return child;
    }
    return undefined;
  }

  function expandableItemIds(
    items: readonly WorkspaceTreeNavigationItem[],
  ): string[] {
    return items.flatMap((item) => [
      ...(item.children?.length ? [item.id] : []),
      ...expandableItemIds(item.children ?? []),
    ]);
  }

  function toggleExpandedItems(
    expandableIds: readonly string[],
    expandedIds: readonly string[],
    onChange?: (ids: string[]) => void,
  ): void {
    if (!onChange) return;
    const hasCollapsed = expandableIds.some((id) => !expandedIds.includes(id));
    onChange(hasCollapsed ? [...expandableIds] : []);
  }

  function toggleTag(id: string): void {
    if (!onSelectedTagIdsChange) return;
    onSelectedTagIdsChange(
      selectedTagIds.includes(id)
        ? selectedTagIds.filter((selectedId) => selectedId !== id)
        : [...selectedTagIds, id],
    );
    onTagSelect?.(id);
  }
</script>

<section
  class="cn-navigation-ledgerworkspacenavigation-224-1"
  aria-label={ariaLabel}
  data-ledger-workspace-navigation
  data-ledger-workspace-sidebar
>
  <div class="cn-navigation-ledgerworkspacenavigation-229-1">
    <p class="cn-navigation-ledgerworkspacenavigation-230-1">{title}</p>
    <span
      class="cn-navigation-ledgerworkspacenavigation-232-1"
      aria-label={`${ledgerCount} ${title.toLocaleLowerCase()}`}
      >{ledgerCount}</span
    >
  </div>

  <div
    class={searchContent
      ? "cn-navigation-ledgerworkspacenavigation-240-1"
      : "cn-navigation-ledgerworkspacenavigation-241-1"}
    aria-label="Ledger navigation views"
  >
    {#each [{ id: "ledgers", label: "Ledgers" }, { id: "folders", label: "Folders" }, { id: "tags", label: "Tags" }] as workspaceView (workspaceView.id)}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class={"cn-navigation-ledgerworkspacenavigation-249-1" +
          (view === workspaceView.id && !searchOpen
            ? "cn-navigation-ledgerworkspacenavigation-251-1"
            : "cn-navigation-ledgerworkspacenavigation-252-1")}
        aria-pressed={view === workspaceView.id && !searchOpen}
        onclick={() => {
          onViewChange?.(workspaceView.id as LedgerWorkspaceView);
          onSearchOpenChange?.(false);
        }}
      >
        {workspaceView.label}
      </Button>
    {/each}
    {#if searchContent}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class={"cn-navigation-ledgerworkspacenavigation-267-1" +
          (searchOpen
            ? "cn-navigation-ledgerworkspacenavigation-269-1"
            : "cn-navigation-ledgerworkspacenavigation-270-1")}
        aria-label={searchOpen ? "Show ledger sidebar" : "Show search sidebar"}
        aria-pressed={searchOpen}
        title={searchOpen ? "Show ledgers" : "Search ledgers"}
        onclick={() => onSearchOpenChange?.(!searchOpen)}
      >
        <SearchIcon aria-hidden="true" />
      </Button>
    {/if}
  </div>

  {#if searchOpen && searchContent}
    {@render searchContent()}
  {:else}
    {#if selectedTags.length}
      <div
        class="cn-navigation-ledgerworkspacenavigation-286-1"
        aria-label="Selected tag filters"
      >
        {#each selectedTags as tag (tag.id)}
          <button
            type="button"
            class="cn-navigation-ledgerworkspacenavigation-292-1"
            aria-label={`Remove ${tag.label} filter`}
            onclick={() => toggleTag(tag.id)}
          >
            <Hash
              class="cn-navigation-ledgerworkspacenavigation-296-1"
              aria-hidden="true"
            />
            <span class="cn-navigation-ledgerworkspacenavigation-297-1"
              >{tag.label}</span
            >
          </button>
        {/each}
        <Button
          type="button"
          variant="ghost"
          size={treeVariant === "ledger" ? "icon" : "icon-sm"}
          class="cn-navigation-ledgerworkspacenavigation-304-1"
          aria-label="Clear tag filters"
          title="Clear tag filters"
          disabled={!onSelectedTagIdsChange}
          onclick={() => onSelectedTagIdsChange?.([])}
        >
          <span aria-hidden="true">×</span>
        </Button>
      </div>
    {/if}

    {#if view === "ledgers"}
      <div class="cn-navigation-ledgerworkspacenavigation-316-1">
        <label class="cn-navigation-ledgerworkspacenavigation-317-1">
          <span class="sr-only">Search ledgers</span>
          <ListFilter
            class="cn-navigation-ledgerworkspacenavigation-320-1"
            aria-hidden="true"
          />
          <Input
            bind:value={ledgerSearch}
            placeholder="Search ledgers"
            class="cn-navigation-ledgerworkspacenavigation-326-1"
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size={treeVariant === "ledger" ? "icon" : "icon-sm"}
          class="cn-navigation-ledgerworkspacenavigation-333-1"
          aria-label={visibleLedgerExpandableIds.some(
            (id) => !ledgerExpandedIds.includes(id),
          )
            ? "Expand all ledgers"
            : "Collapse all ledgers"}
          title={visibleLedgerExpandableIds.some(
            (id) => !ledgerExpandedIds.includes(id),
          )
            ? "Expand all ledgers"
            : "Collapse all ledgers"}
          disabled={!visibleLedgerExpandableIds.length ||
            !onLedgerExpandedIdsChange}
          onclick={() =>
            toggleExpandedItems(
              visibleLedgerExpandableIds,
              ledgerExpandedIds,
              onLedgerExpandedIdsChange,
            )}
        >
          {#if visibleLedgerExpandableIds.some((id) => !ledgerExpandedIds.includes(id))}
            <ChevronsUpDown aria-hidden="true" />
          {:else}
            <ChevronsDownUp aria-hidden="true" />
          {/if}
        </Button>
      </div>

      <div
        class={treeVariant === "ledger"
          ? "cn-navigation-ledgerworkspacenavigation-363-1"
          : "cn-navigation-ledgerworkspacenavigation-364-1"}
        data-ledger-scroll-area={treeVariant === "ledger" || undefined}
      >
        <WorkspaceTreeNavigation
          items={visibleLedgerItems}
          activeId={activeLedgerId}
          expandedIds={ledgerExpandedIds}
          ariaLabel="Ledger files"
          emptyLabel={ledgerSearch.trim()
            ? "No ledgers match the current filter."
            : "No ledger files found."}
          showExpandAll={false}
          variant={treeVariant}
          onSelect={onLedgerSelect}
          onExpandedIdsChange={onLedgerExpandedIdsChange}
        />

        {#if queryPicker || accountPicker || resources.length}
          <div
            class={treeVariant === "ledger"
              ? "cn-navigation-ledgerworkspacenavigation-384-1"
              : "cn-navigation-ledgerworkspacenavigation-385-1"}
          >
            <p
              class={treeVariant === "ledger"
                ? "cn-navigation-ledgerworkspacenavigation-389-1"
                : "cn-navigation-ledgerworkspacenavigation-390-1"}
            >
              Ledger tools
            </p>
            {#if queryPicker || accountPicker}
              <div class="cn-navigation-ledgerworkspacenavigation-395-1">
                {#if queryPicker}
                  <div class="cn-navigation-ledgerworkspacenavigation-397-1">
                    <FilterCommandPicker
                      fullWidth
                      label={queryPicker.label}
                      ariaLabel={queryPicker.ariaLabel ?? queryPicker.label}
                      placeholder={queryPicker.placeholder}
                      value={queryPicker.value}
                      options={[...queryPicker.options]}
                      onChange={(value) => onQueryChange?.(value)}
                    />
                  </div>
                {/if}
                {#if accountPicker}
                  <div class="cn-navigation-ledgerworkspacenavigation-410-1">
                    <FilterCommandPicker
                      fullWidth
                      label={accountPicker.label}
                      ariaLabel={accountPicker.ariaLabel ?? accountPicker.label}
                      placeholder={accountPicker.placeholder}
                      value={accountPicker.value}
                      options={[...accountPicker.options]}
                      onChange={(value) => onAccountChange?.(value)}
                    />
                  </div>
                {/if}
              </div>
            {/if}
            {#each resources as resource (resource.id)}
              {@const Icon = resource.icon ?? Sparkles}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="cn-navigation-ledgerworkspacenavigation-430-1"
                disabled={resource.disabled || !onResourceSelect}
                onclick={() => onResourceSelect?.(resource.id)}
              >
                <Icon
                  class="cn-navigation-ledgerworkspacenavigation-434-1"
                  aria-hidden="true"
                />
                <span class="cn-navigation-ledgerworkspacenavigation-435-1"
                  >{resource.label}</span
                >
              </Button>
            {/each}
          </div>
        {/if}
      </div>
    {:else if view === "folders"}
      <div class="cn-navigation-ledgerworkspacenavigation-442-1">
        <label class="cn-navigation-ledgerworkspacenavigation-443-1">
          <span class="sr-only">Search folders</span>
          <ListFilter
            class="cn-navigation-ledgerworkspacenavigation-446-1"
            aria-hidden="true"
          />
          <Input
            bind:value={folderSearch}
            placeholder="Search folders"
            class="cn-navigation-ledgerworkspacenavigation-452-1"
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size={treeVariant === "ledger" ? "icon" : "icon-sm"}
          class="cn-navigation-ledgerworkspacenavigation-459-1"
          aria-label={visibleFolderExpandableIds.some(
            (id) => !folderExpandedIds.includes(id),
          )
            ? "Expand all filesystem folders"
            : "Collapse all filesystem folders"}
          title={visibleFolderExpandableIds.some(
            (id) => !folderExpandedIds.includes(id),
          )
            ? "Expand all filesystem folders"
            : "Collapse all filesystem folders"}
          disabled={!visibleFolderExpandableIds.length ||
            !onFolderExpandedIdsChange}
          onclick={() =>
            toggleExpandedItems(
              visibleFolderExpandableIds,
              folderExpandedIds,
              onFolderExpandedIdsChange,
            )}
        >
          {#if visibleFolderExpandableIds.some((id) => !folderExpandedIds.includes(id))}
            <ChevronsUpDown aria-hidden="true" />
          {:else}
            <ChevronsDownUp aria-hidden="true" />
          {/if}
        </Button>
      </div>

      <div
        class={treeVariant === "ledger"
          ? "cn-navigation-ledgerworkspacenavigation-489-1"
          : "cn-navigation-ledgerworkspacenavigation-490-1"}
        data-folder-scroll-area={treeVariant === "ledger" || undefined}
      >
        <WorkspaceTreeNavigation
          items={visibleFolderItems}
          expandedIds={folderExpandedIds}
          ariaLabel="Ledger folders"
          emptyLabel="No folders match the current filter."
          showExpandAll={false}
          variant={treeVariant}
          onSelect={onFolderSelect}
          onExpandedIdsChange={onFolderExpandedIdsChange}
        />
      </div>
    {:else}
      <div class="cn-navigation-ledgerworkspacenavigation-505-1">
        <label class="cn-navigation-ledgerworkspacenavigation-506-1">
          <span class="sr-only">Search tags</span>
          <ListFilter
            class="cn-navigation-ledgerworkspacenavigation-509-1"
            aria-hidden="true"
          />
          <Input
            bind:value={tagSearch}
            placeholder="Search tags"
            class="cn-navigation-ledgerworkspacenavigation-515-1"
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          class="cn-navigation-ledgerworkspacenavigation-522-1"
          aria-label={tagsPresentation === "tree"
            ? "Showing tag hierarchy. Switch to flat tags."
            : "Showing flat tags. Switch to tag hierarchy."}
          title={tagsPresentation === "tree"
            ? "Showing tag hierarchy. Switch to flat tags."
            : "Showing flat tags. Switch to tag hierarchy."}
          aria-pressed={tagsPresentation === "tree"}
          disabled={!onTagsPresentationChange}
          onclick={() =>
            onTagsPresentationChange?.(
              tagsPresentation === "tree" ? "flat" : "tree",
            )}
        >
          {#if tagsPresentation === "tree"}
            <FolderTree aria-hidden="true" />
          {:else}
            <List aria-hidden="true" />
          {/if}
        </Button>
      </div>

      <div
        class={treeVariant === "ledger"
          ? "cn-navigation-ledgerworkspacenavigation-546-1"
          : "cn-navigation-ledgerworkspacenavigation-547-1"}
        data-tags-scroll-area={treeVariant === "ledger" || undefined}
      >
        {#if tagsPresentation === "tree"}
          <WorkspaceTreeNavigation
            items={visibleTagItems}
            expandedIds={tagExpandedIds}
            ariaLabel="Ledger tags"
            emptyLabel="No tags match the current filter."
            showExpandAll
            variant={treeVariant}
            onSelect={toggleTag}
            onExpandedIdsChange={onTagExpandedIdsChange}
          />
        {:else if flatTagItems.length}
          <div
            class="cn-navigation-ledgerworkspacenavigation-562-1"
            aria-label="Flat ledger tags"
          >
            {#each flatTagItems as tag (tag.id)}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="cn-navigation-ledgerworkspacenavigation-568-1"
                aria-pressed={selectedTagIds.includes(tag.id)}
                title={tag.label}
                disabled={tag.disabled || !onSelectedTagIdsChange}
                onclick={() => toggleTag(tag.id)}
              >
                <Hash
                  class="cn-navigation-ledgerworkspacenavigation-574-1"
                  aria-hidden="true"
                />
                <span class="cn-navigation-ledgerworkspacenavigation-575-1"
                  >{tag.label}</span
                >
                {#if tag.badge}
                  <span class="cn-navigation-ledgerworkspacenavigation-579-1"
                    >{tag.badge}</span
                  >
                {/if}
              </Button>
            {/each}
          </div>
        {:else}
          <p class="cn-navigation-ledgerworkspacenavigation-585-1">
            No tags match the current filter.
          </p>
        {/if}
      </div>
    {/if}
  {/if}
</section>
