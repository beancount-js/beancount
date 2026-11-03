<script lang="ts">
  import {
    ArrowLeft,
    ChevronDown,
    ChevronRight,
    ClipboardList,
    ChevronsDownUp,
    ChevronsUpDown,
    FileText,
    Folder,
    FolderTree,
    Hash,
    History,
    Landmark,
    Palette,
    BookUser,
    Store,
    List,
    ListFilter,
    ShieldX,
    RefreshCw,
    Wand2,
    Sparkles,
    X,
  } from "@lucide/svelte";
  import { Query } from "@beancount-js/beancount";
  import { untrack } from "svelte";
  import { FilterCommandPicker, FormField } from "../forms";
  import { accountAvatarImageDataUrl } from "../forms/account-avatar";
  import type { BeancountController, WorkspaceView } from "../../controller";
  import type { ProjectFile } from "@beancount-js/workspace";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as ScrollArea from "@lapismd/design-core/shadcn/scroll-area";
  import { cn } from "../../domain/lib/utils";
  import { MainNav, type MenuItem } from "../../domain/menu";
  import {
    collectExpandableLedgerFolderIds,
    createLedgerFolderTree,
    createLedgerTagSummaries,
    createLedgerTagTree,
    filterLedgerFiles,
    filterLedgerFolderTree,
    filterLedgerTagsByPathMatch,
    ledgerFileLabel,
    ledgerFolderAncestorIds,
    normalizeLedgerTag,
    type LedgerFolderNode,
    type LedgerTagTreeNode,
  } from "./ledger-sidebar";

  let {
    controller,
    onNavigate,
  }: { controller: BeancountController; onNavigate: () => void } = $props();
  const { ledgerSource } = untrack(() => controller.presentation);
  const { reviewLedger } = untrack(() => controller.workspace);
  const sidebar = $derived(controller.state.sidebar);
  const actions = $derived(controller.actions.sidebar);
  const files = $derived(controller.state.snapshot?.ledgerFiles ?? []);
  const activeRoute = $derived(controller.state.route);
  const activeViewPath = $derived(activeRoute.path);
  const review = $derived($reviewLedger);
  const hasActiveReview = $derived(Boolean(review?.reviewableCount));
  const workspaceView = $derived(sidebar.view);
  const tagsViewMode = $derived(sidebar.tagsView);
  const ledgerQuery = $derived(sidebar.searches.ledgers);
  const folderQuery = $derived(sidebar.searches.folders);
  const tagQuery = $derived(sidebar.searches.tags);
  const selectedTags = $derived(sidebar.selectedTags);
  const expandedFilePaths = $derived(sidebar.expanded.files);
  const folderOpenNodes = $derived(sidebar.expanded.folders);
  const tagOpenNodes = $derived(sidebar.expanded.tags);
  const importSettingsOpen = $derived(sidebar.settingsGroups.import);
  const reviewSettingsOpen = $derived(sidebar.settingsGroups.review);
  const menuItems = $derived([
    ...MainNav,
    ...(controller.state.ledger.errors.length
      ? [{ name: "Errors", path: "/errors", icon: ShieldX }]
      : []),
  ]);
  const filteredByTags = $derived(
    filterLedgerFiles(files, "", [...selectedTags]),
  );
  const visibleLedgerFiles = $derived(
    filterLedgerFiles(files, ledgerQuery, [...selectedTags]),
  );
  const folderTree = $derived(
    filterLedgerFolderTree(createLedgerFolderTree(filteredByTags), folderQuery),
  );
  const expandableFolderIds = $derived(
    folderTree ? collectExpandableLedgerFolderIds(folderTree) : [],
  );
  const hasCollapsedFolders = $derived(
    expandableFolderIds.some((id) => !isFolderOpen(id)),
  );
  const filteredTags = $derived(
    filterLedgerTagsByPathMatch(createLedgerTagSummaries(files), tagQuery),
  );
  const tagTree = $derived(createLedgerTagTree(filteredTags));
  const queries = $derived(
    $ledgerSource.directives
      .filter((directive) => directive instanceof Query)
      .map((directive) => ({ label: directive.name, value: directive.query })),
  );
  const accounts = $derived(
    [
      ...new Set(
        $ledgerSource.directives
          .flatMap((directive) => directive.accounts)
          .filter(Boolean),
      ),
    ].map((account) => ({
      label: account,
      value: account,
      imageUrl: accountAvatarImageDataUrl(account),
    })),
  );
  const queryPickerOptions = $derived([
    { value: "all", label: "Select query" },
    ...queries,
  ]);
  const accountPickerOptions = $derived([
    { value: "all", label: "Select account" },
    { value: "-", label: "All accounts" },
    ...accounts,
  ]);
  function navigate(path: string) {
    controller.actions.navigate(path);
    onNavigate();
  }
  function isFileExpanded(path: string, nodes = expandedFilePaths) {
    return nodes[path] ?? path === controller.state.activeFile;
  }
  function toggleLedgerFile(path: string) {
    actions.setExpanded("files", path, !isFileExpanded(path));
  }
  function selectLedgerFile(path: string) {
    if (path === controller.state.activeFile) toggleLedgerFile(path);
    else {
      controller.actions.selectFile(path, "/dashboard");
      onNavigate();
    }
  }
  function openLedgerPanel(path: string, panel: MenuItem) {
    controller.actions.selectFile(path, panel.path);
    onNavigate();
  }
  function closeLedgerSettings() {
    controller.actions.returnFromSettings();
    onNavigate();
  }
  function openLedgerSetting(path: string) {
    controller.actions.openSettings(path);
    onNavigate();
  }
  function isLedgerSettingActive(path: string, route: string) {
    return path === route;
  }
  function isPanelActive(panel: MenuItem, path: string) {
    return panel.path === path;
  }
  function hasCollapsedFiles() {
    return visibleLedgerFiles.some((file) => !isFileExpanded(file.path));
  }
  function toggleAllFiles() {
    actions.setExpandedNodes(
      "files",
      Object.fromEntries(
        visibleLedgerFiles.map((file) => [file.path, hasCollapsedFiles()]),
      ),
    );
  }
  function isFolderOpen(id: string, nodes = folderOpenNodes) {
    return (
      nodes[id] ??
      ledgerFolderAncestorIds(controller.state.activeFile).includes(id)
    );
  }
  function toggleFolder(id: string) {
    actions.setExpanded("folders", id, !isFolderOpen(id));
  }
  function toggleAllFolders() {
    actions.setExpandedNodes(
      "folders",
      Object.fromEntries(
        expandableFolderIds.map((id) => [id, hasCollapsedFolders]),
      ),
    );
  }
  function isTagOpen(tag: string, nodes = tagOpenNodes) {
    return nodes[tag] ?? true;
  }
  function toggleTag(tag: string) {
    actions.setExpanded("tags", tag, !isTagOpen(tag));
  }
  function selectTag(tag: string) {
    const normalized = normalizeLedgerTag(tag);
    if (!selectedTags.includes(normalized))
      controller.actions.selectTags([...selectedTags, normalized]);
  }
  function removeTag(tag: string) {
    controller.actions.selectTags(
      selectedTags.filter((selected) => selected !== tag),
    );
  }
  function clearSelectedTags() {
    controller.actions.selectTags([]);
  }
  function navigateToAccount(account: string) {
    navigate(
      account === "-" ? "/accounts" : `/account/${encodeURIComponent(account)}`,
    );
  }
  function navigateToQuery(query: string) {
    navigate(`/query?qs=${encodeURIComponent(query)}`);
  }
  function openResource(path: string) {
    navigate(`/resource?path=${encodeURIComponent(path)}`);
  }
  function fileRowStyle(depth: number) {
    return `padding-left: ${0.25 + Math.max(depth, 0) * 0.875}rem`;
  }
  function filePanelStyle(depth: number) {
    // Row border + leading inset + one disclosure gutter.
    return `padding-left: ${1.1875 + Math.max(depth, 0) * 0.875}rem`;
  }
  const folderRowStyle = fileRowStyle;
  const tagRowStyle = fileRowStyle;
  function indentGuideDepths(depth: number) {
    return Array.from({ length: Math.max(depth, 0) }, (_, index) => index);
  }
  function indentGuideStyle(depth: number) {
    return `left: ${0.75 + depth * 0.875}rem`;
  }
</script>

<div
  role="navigation"
  aria-label={sidebar.settings ? "Ledger settings" : "Ledger reports"}
  class="flex min-h-0 flex-1 flex-col gap-3"
>
  {#if sidebar.settings}
    <div
      class="flex min-h-0 flex-1 flex-col gap-3"
      data-ledger-settings-sidebar
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="h-8 w-full justify-start gap-2 px-2 text-left text-muted-foreground hover:bg-background hover:text-sidebar-foreground"
        aria-label="Back to ledger navigation"
        onclick={closeLedgerSettings}
      >
        <ArrowLeft data-icon="inline-start" />
        <span class="text-xs font-medium">Back</span>
      </Button>

      <div class="flex min-h-0 flex-1 flex-col gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class={cn(
            "h-auto w-full justify-start gap-2 px-2 py-2 text-left",
            isLedgerSettingActive("/import/accounts", activeViewPath)
              ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
              : "text-muted-foreground hover:bg-background hover:text-sidebar-foreground",
          )}
          aria-current={isLedgerSettingActive(
            "/import/accounts",
            activeViewPath,
          )
            ? "page"
            : undefined}
          disabled={files.length === 0}
          onclick={() => openLedgerSetting("/import/accounts")}
        >
          <Landmark data-icon="inline-start" />
          <span class="min-w-0 flex-1 truncate text-xs font-medium"
            >Accounts</span
          >
        </Button>

        <div class="flex flex-col gap-1">
          <div
            class={cn(
              "flex items-center rounded-md",
              isLedgerSettingActive("/import/editor", activeViewPath)
                ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="ml-1 size-6 shrink-0"
              data-settings-disclosure
              aria-label={importSettingsOpen
                ? "Collapse import navigation"
                : "Expand import navigation"}
              aria-expanded={importSettingsOpen}
              onclick={() => actions.toggleSettingsGroup("import")}
            >
              <ChevronDown
                class={cn(
                  "transition-transform",
                  importSettingsOpen ? "" : "-rotate-90",
                )}
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="h-auto min-w-0 flex-1 justify-start gap-2 px-1 py-2 text-left hover:bg-transparent"
              data-settings-group-label
              aria-current={isLedgerSettingActive(
                "/import/editor",
                activeViewPath,
              )
                ? "page"
                : undefined}
              disabled={files.length === 0}
              onclick={() => openLedgerSetting("/import/editor")}
            >
              <RefreshCw data-icon="inline-start" />
              <span class="min-w-0 flex-1 truncate text-xs font-medium"
                >Bank Sync</span
              >
            </Button>
          </div>

          {#if importSettingsOpen}
            <div
              class="ml-4 flex flex-col gap-1 border-l border-sidebar-border pl-2"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class={cn(
                  "h-auto w-full justify-start gap-2 px-2 py-2 text-left",
                  isLedgerSettingActive("/import/history", activeViewPath)
                    ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
                    : "text-muted-foreground hover:bg-background hover:text-sidebar-foreground",
                )}
                aria-current={isLedgerSettingActive(
                  "/import/history",
                  activeViewPath,
                )
                  ? "page"
                  : undefined}
                disabled={files.length === 0}
                onclick={() => openLedgerSetting("/import/history")}
              >
                <History data-icon="inline-start" />
                <span class="min-w-0 flex-1 truncate text-xs font-medium"
                  >History</span
                >
              </Button>
              {#if hasActiveReview}
                <div class="flex flex-col gap-1">
                  <div
                    class={cn(
                      "flex items-center rounded-md",
                      isLedgerSettingActive("/records", activeViewPath) ||
                        isLedgerSettingActive(
                          "/import/merchants",
                          activeViewPath,
                        )
                        ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="ml-1 size-6 shrink-0"
                      data-settings-disclosure
                      aria-label={reviewSettingsOpen
                        ? "Collapse review navigation"
                        : "Expand review navigation"}
                      aria-expanded={reviewSettingsOpen}
                      onclick={() => actions.toggleSettingsGroup("review")}
                    >
                      <ChevronDown
                        class={cn(
                          "transition-transform",
                          reviewSettingsOpen ? "" : "-rotate-90",
                        )}
                      />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      class="h-auto min-w-0 flex-1 justify-start gap-2 px-1 py-2 text-left hover:bg-transparent"
                      data-settings-group-label
                      aria-current={isLedgerSettingActive(
                        "/records",
                        activeViewPath,
                      )
                        ? "page"
                        : undefined}
                      disabled={files.length === 0}
                      onclick={() => openLedgerSetting("/records")}
                    >
                      <ClipboardList data-icon="inline-start" />
                      <span class="min-w-0 flex-1 truncate text-xs font-medium"
                        >Review</span
                      >
                      <span
                        class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground"
                        title={`${review!.reviewableCount} items in active review`}
                        >{review!.reviewableCount}</span
                      >
                    </Button>
                  </div>

                  {#if reviewSettingsOpen}
                    <div
                      class="ml-4 flex flex-col gap-1 border-l border-sidebar-border pl-2"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class={cn(
                          "h-auto w-full justify-start gap-2 px-2 py-2 text-left",
                          isLedgerSettingActive(
                            "/import/merchants",
                            activeViewPath,
                          )
                            ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
                            : "text-muted-foreground hover:bg-background hover:text-sidebar-foreground",
                        )}
                        aria-current={isLedgerSettingActive(
                          "/import/merchants",
                          activeViewPath,
                        )
                          ? "page"
                          : undefined}
                        disabled={files.length === 0}
                        onclick={() => openLedgerSetting("/import/merchants")}
                      >
                        <Store data-icon="inline-start" />
                        <span
                          class="min-w-0 flex-1 truncate text-xs font-medium"
                          >Merchants</span
                        >
                      </Button>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          class={cn(
            "h-auto w-full justify-start gap-2 px-2 py-2 text-left",
            isLedgerSettingActive("/import/manage-merchants", activeViewPath)
              ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
              : "text-muted-foreground hover:bg-background hover:text-sidebar-foreground",
          )}
          aria-current={isLedgerSettingActive(
            "/import/manage-merchants",
            activeViewPath,
          )
            ? "page"
            : undefined}
          disabled={files.length === 0}
          onclick={() => openLedgerSetting("/import/manage-merchants")}
        >
          <BookUser data-icon="inline-start" />
          <span class="min-w-0 flex-1 truncate text-xs font-medium"
            >Merchants</span
          >
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class={cn(
            "h-auto w-full justify-start gap-2 px-2 py-2 text-left",
            isLedgerSettingActive("/import/brands", activeViewPath)
              ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
              : "text-muted-foreground hover:bg-background hover:text-sidebar-foreground",
          )}
          aria-current={isLedgerSettingActive("/import/brands", activeViewPath)
            ? "page"
            : undefined}
          disabled={files.length === 0}
          onclick={() => openLedgerSetting("/import/brands")}
        >
          <Palette data-icon="inline-start" />
          <span class="min-w-0 flex-1 truncate text-xs font-medium"
            >Brand match</span
          >
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class={cn(
            "h-auto w-full justify-start gap-2 px-2 py-2 text-left",
            isLedgerSettingActive("/import/rules", activeViewPath)
              ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
              : "text-muted-foreground hover:bg-background hover:text-sidebar-foreground",
          )}
          aria-current={isLedgerSettingActive("/import/rules", activeViewPath)
            ? "page"
            : undefined}
          disabled={files.length === 0}
          onclick={() => openLedgerSetting("/import/rules")}
        >
          <Wand2 data-icon="inline-start" />
          <span class="min-w-0 flex-1 truncate text-xs font-medium">Rules</span>
        </Button>
      </div>
    </div>
  {:else}
    <div class="flex items-center justify-between gap-2 px-2">
      <p class="text-xs font-medium uppercase text-muted-foreground">Ledgers</p>
      <span
        class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground"
        >{files.length}</span
      >
    </div>

    <ToggleGroup.Root
      type="single"
      value={workspaceView}
      onValueChange={(value) => {
        if (value) actions.setView(value as WorkspaceView);
      }}
      spacing={1}
      size="sm"
      class="beancount-workspace-views"
      aria-label="Ledger navigation views"
    >
      {#each [{ id: "ledgers", label: "Ledgers" }, { id: "folders", label: "Folders" }, { id: "tags", label: "Tags" }] as view (view.id)}
        <ToggleGroup.Item value={view.id} data-workspace-view={view.id}>
          {view.label}
        </ToggleGroup.Item>
      {/each}
    </ToggleGroup.Root>

    {#if selectedTags.length}
      <div
        class="relative flex flex-wrap items-center gap-1.5 rounded-md border border-sidebar-border bg-background/55 py-1.5 pl-2 pr-9 text-xs text-muted-foreground"
        aria-label="Selected tag filters"
      >
        {#each selectedTags as tag (tag)}
          <button
            type="button"
            class="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-semibold leading-none text-primary hover:bg-primary/15"
            aria-label={`Remove #${tag} filter`}
            onclick={() => removeTag(tag)}
          >
            <Hash class="h-3 w-3 shrink-0" aria-hidden="true" />
            <span class="min-w-0 truncate">{tag}</span>
            <X class="h-3 w-3 shrink-0 opacity-75" aria-hidden="true" />
          </button>
        {/each}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="absolute right-1.5 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full text-muted-foreground hover:bg-background hover:text-sidebar-foreground"
          aria-label="Clear tag filters"
          title="Clear tag filters"
          onclick={clearSelectedTags}
        >
          <X data-icon />
        </Button>
      </div>
    {/if}

    {#if workspaceView === "ledgers"}
      <div class="flex items-center gap-1">
        <label class="relative min-w-0 flex-1">
          <ListFilter
            class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={ledgerQuery}
            aria-label="Search ledgers"
            oninput={(event) =>
              actions.setSearch("ledgers", event.currentTarget.value)}
            placeholder="Search ledgers"
            class="h-8 bg-sidebar pl-8 text-xs"
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-7 rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-sidebar-accent-foreground"
          aria-label={hasCollapsedFiles()
            ? "Expand all ledgers"
            : "Collapse all ledgers"}
          title={hasCollapsedFiles()
            ? "Expand all ledgers"
            : "Collapse all ledgers"}
          disabled={!visibleLedgerFiles.length}
          onclick={toggleAllFiles}
        >
          {#if hasCollapsedFiles()}
            <ChevronsUpDown data-icon />
          {:else}
            <ChevronsDownUp data-icon />
          {/if}
        </Button>
      </div>

      <ScrollArea.Root
        class="-mr-2 min-h-0 min-w-0 flex-1"
        data-ledger-scroll-area
      >
        <div
          class="flex min-w-0 flex-col gap-1 overflow-x-hidden pr-4"
          data-ledger-list
        >
          {#each visibleLedgerFiles as file (file.path)}
            {@render LedgerFileRow({ file, depth: 0 })}
          {:else}
            <p class="px-2 text-xs text-muted-foreground">
              {ledgerQuery.trim() || selectedTags.length
                ? "No ledgers match the current filter."
                : "No ledger files found."}
            </p>
          {/each}

          {#if review && !ledgerQuery.trim() && !selectedTags.length}
            {@render ReviewLedgerRow({ review })}
          {/if}

          {#if queries.length || accounts.length || controller.state.snapshot?.resources.length}
            <div
              class="mt-2 flex flex-col gap-2 border-t border-sidebar-border pt-3"
            >
              <p
                class="px-2 text-xs font-medium uppercase text-muted-foreground"
              >
                Ledger tools
              </p>
              {#if queries.length || accounts.length}
                <div class="beancount-structured-form">
                  {#if queries.length}
                    <FormField as="div" align="center" label="">
                      <FilterCommandPicker
                        fullWidth
                        label="Query"
                        ariaLabel="Select query"
                        placeholder="Filter queries..."
                        value={activeRoute.query["qs"] ?? "all"}
                        options={queryPickerOptions}
                        onChange={(value) => {
                          if (value && value !== "all") navigateToQuery(value);
                        }}
                      />
                    </FormField>
                  {/if}
                  {#if accounts.length}
                    <FormField as="div" align="center" label="">
                      <FilterCommandPicker
                        fullWidth
                        label="Account"
                        ariaLabel="Select account"
                        placeholder="Filter accounts..."
                        value={activeRoute.params["account"] ?? "all"}
                        options={accountPickerOptions}
                        onChange={(value) => {
                          if (!value || value === "all") navigateToAccount("-");
                          else navigateToAccount(value);
                        }}
                      />
                    </FormField>
                  {/if}
                </div>
              {/if}
              {#each controller.state.snapshot?.resources ?? [] as resource (resource.path)}
                <Button
                  variant="ghost"
                  size="sm"
                  class="w-full justify-start"
                  onclick={() => openResource(resource.path)}
                >
                  <Sparkles data-icon="inline-start" />
                  <span class="truncate">{resource.path}</span>
                </Button>
              {/each}
            </div>
          {/if}
        </div>
      </ScrollArea.Root>
    {:else if workspaceView === "folders"}
      <div class="flex items-center gap-1">
        <label class="relative min-w-0 flex-1">
          <ListFilter
            class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={folderQuery}
            aria-label="Search folders"
            oninput={(event) =>
              actions.setSearch("folders", event.currentTarget.value)}
            placeholder="Search folders"
            class="h-8 bg-sidebar pl-8 text-xs"
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-7 rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-sidebar-accent-foreground"
          aria-label={hasCollapsedFolders
            ? "Expand all filesystem folders"
            : "Collapse all filesystem folders"}
          title={hasCollapsedFolders
            ? "Expand all filesystem folders"
            : "Collapse all filesystem folders"}
          disabled={!expandableFolderIds.length}
          onclick={toggleAllFolders}
        >
          {#if hasCollapsedFolders}
            <ChevronsUpDown data-icon />
          {:else}
            <ChevronsDownUp data-icon />
          {/if}
        </Button>
      </div>

      <ScrollArea.Root
        class="-mr-2 min-h-0 min-w-0 flex-1"
        data-folder-scroll-area
      >
        <div
          class="flex min-w-0 flex-col gap-1 overflow-x-hidden pr-4"
          data-folder-list
        >
          {#if folderTree}
            {@render FolderNode({ node: folderTree })}
          {:else}
            <p class="px-2 text-xs text-muted-foreground">
              No folders match the current filter.
            </p>
          {/if}
        </div>
      </ScrollArea.Root>
    {:else}
      <div class="flex items-center gap-1">
        <label class="relative min-w-0 flex-1">
          <ListFilter
            class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={tagQuery}
            aria-label="Search tags"
            oninput={(event) =>
              actions.setSearch("tags", event.currentTarget.value)}
            placeholder="Search tags"
            class="h-8 bg-sidebar pl-8 text-xs"
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-7 shrink-0 border border-sidebar-border bg-background shadow-sm hover:bg-background"
          aria-label={tagsViewMode === "tree"
            ? "Showing tag hierarchy. Switch to flat tags."
            : "Showing flat tags. Switch to tag hierarchy."}
          title={tagsViewMode === "tree"
            ? "Showing tag hierarchy. Switch to flat tags."
            : "Showing flat tags. Switch to tag hierarchy."}
          aria-pressed={tagsViewMode === "tree"}
          onclick={() =>
            actions.setTagsView(tagsViewMode === "tree" ? "flat" : "tree")}
        >
          {#if tagsViewMode === "tree"}
            <FolderTree data-icon />
          {:else}
            <List data-icon />
          {/if}
        </Button>
      </div>

      <ScrollArea.Root
        class="-mr-2 min-h-0 min-w-0 flex-1"
        data-tags-scroll-area
      >
        <div
          class="flex min-w-0 flex-col gap-1 overflow-x-hidden pr-4"
          data-tags-list
        >
          {#if tagsViewMode === "tree"}
            {#each tagTree as node (node.tag)}
              {@render TagTreeNode({ node })}
            {:else}
              <p class="px-2 text-xs text-muted-foreground">
                No tags match the current filter.
              </p>
            {/each}
          {:else}
            {#each filteredTags as tag (tag.tag)}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="h-8 w-full min-w-0 justify-start gap-2 px-2 text-xs text-muted-foreground hover:bg-background hover:text-sidebar-foreground"
                title={`#${tag.tag}`}
                onclick={() => selectTag(tag.tag)}
              >
                <Hash data-icon="inline-start" />
                <span class="min-w-0 flex-1 truncate text-left">{tag.tag}</span>
                <span class="text-[10px] tabular-nums">{tag.fileCount}</span>
              </Button>
            {:else}
              <p class="px-2 text-xs text-muted-foreground">
                No tags match the current filter.
              </p>
            {/each}
          {/if}
        </div>
      </ScrollArea.Root>
    {/if}
  {/if}
</div>

{#snippet LedgerFileRow({ file, depth }: { file: ProjectFile; depth: number })}
  {@const expanded = isFileExpanded(file.path, expandedFilePaths)}
  {@const active = file.path === controller.state.activeFile}
  {@const label = ledgerFileLabel(file)}
  <div class="flex min-w-0 flex-col gap-1" data-ledger-file-node={file.path}>
    <div
      class={cn(
        "relative flex h-8 min-w-0 items-center rounded-md text-xs font-semibold transition-colors",
        active
          ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
          : "border border-transparent text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
      )}
      style={fileRowStyle(depth)}
      data-ledger-tree-row
      data-active={active}
    >
      {@render IndentGuides({ depth })}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="relative z-10 size-7 shrink-0 rounded-sm p-0 hover:bg-background/70"
        aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
        aria-expanded={expanded}
        data-ledger-file-toggle={file.path}
        onclick={() => toggleLedgerFile(file.path)}
      >
        <ChevronRight
          data-icon
          class={cn("transition-transform", expanded && "rotate-90")}
        />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="relative z-10 h-8 min-w-0 flex-1 justify-start gap-1 rounded-sm px-1 text-xs font-semibold hover:bg-background/70"
        data-ledger-file-row={file.path}
        title={file.path}
        onclick={() => selectLedgerFile(file.path)}
      >
        <FileText data-icon="inline-start" />
        <span class="min-w-0 flex-1 truncate text-left">{label}</span>
      </Button>
    </div>
    {#if expanded}
      <div
        class="flex min-w-0 flex-col gap-1"
        data-ledger-file-panels={file.path}
      >
        {#each menuItems as panel (panel.path)}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class={cn(
              "relative h-8 w-full justify-start rounded-md pr-2 text-xs",
              active && isPanelActive(panel, activeRoute.path)
                ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
                : "text-muted-foreground hover:bg-background hover:text-sidebar-foreground",
            )}
            style={filePanelStyle(depth)}
            data-ledger-report-row
            data-active={active && isPanelActive(panel, activeRoute.path)}
            aria-current={active && isPanelActive(panel, activeRoute.path)
              ? "page"
              : undefined}
            onclick={() => openLedgerPanel(file.path, panel)}
          >
            {@render IndentGuides({ depth: depth + 1 })}
            <panel.icon data-icon="inline-start" />
            <span class="truncate">{panel.name}</span>
          </Button>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet ReviewLedgerRow({
  review,
}: {
  review: NonNullable<typeof $reviewLedger>;
})}
  {@const expanded = isFileExpanded(review.path, expandedFilePaths)}
  {@const active = review.path === controller.state.activeFile}
  <div
    class="flex min-w-0 flex-col gap-1"
    data-review-ledger-node={review.path}
  >
    <div
      class={cn(
        "relative flex h-8 min-w-0 items-center rounded-md text-xs font-semibold transition-colors",
        active
          ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
          : "border border-transparent text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
      )}
      style={fileRowStyle(0)}
      data-ledger-tree-row
      data-active={active}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="relative z-10 size-7 shrink-0 rounded-sm p-0 hover:bg-transparent"
        aria-label={expanded
          ? "Collapse review transactions"
          : "Expand review transactions"}
        aria-expanded={expanded}
        data-ledger-file-toggle={review.path}
        onclick={() => toggleLedgerFile(review.path)}
      >
        <ChevronRight
          data-icon
          class={cn("transition-transform", expanded && "rotate-90")}
        />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="relative z-10 h-8 min-w-0 flex-1 justify-start gap-1 rounded-sm px-1 text-xs font-semibold hover:bg-transparent"
        title="Active review transactions"
        data-ledger-file-row={review.path}
        onclick={() => {
          controller.actions.selectFile(review.path, "/journal");
          onNavigate();
        }}
      >
        <ClipboardList data-icon="inline-start" />
        <span class="min-w-0 flex-1 truncate text-left"
          >Review transactions</span
        >
        <span class="text-[10px] tabular-nums text-muted-foreground"
          >{review.reviewableCount}</span
        >
      </Button>
    </div>
    {#if expanded}
      <div
        class="flex min-w-0 flex-col gap-1"
        data-review-ledger-panels={review.path}
      >
        {#each menuItems as panel (panel.path)}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class={cn(
              "relative h-8 w-full justify-start rounded-md pr-2 text-xs",
              active && isPanelActive(panel, activeRoute.path)
                ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
                : "text-muted-foreground hover:bg-background hover:text-sidebar-foreground",
            )}
            style={filePanelStyle(0)}
            data-ledger-report-row
            data-active={active && isPanelActive(panel, activeRoute.path)}
            aria-current={active && isPanelActive(panel, activeRoute.path)
              ? "page"
              : undefined}
            onclick={() => openLedgerPanel(review.path, panel)}
          >
            <panel.icon data-icon="inline-start" />
            <span class="truncate">{panel.name}</span>
          </Button>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet FolderNode({
  node,
  depth = 0,
}: {
  node: LedgerFolderNode;
  depth?: number;
})}
  {@const expanded = isFolderOpen(node.id, folderOpenNodes)}
  <div class="flex min-w-0 flex-col gap-1" data-ledger-folder-node={node.id}>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="relative h-8 w-full min-w-0 justify-start gap-1 pr-1 text-xs text-sidebar-foreground hover:bg-background hover:text-sidebar-accent-foreground"
      style={folderRowStyle(depth)}
      aria-expanded={expanded}
      title={node.path || "Ledgers"}
      data-ledger-folder-row={node.path || "ledgers"}
      data-ledger-tree-row
      data-active="false"
      onclick={() => toggleFolder(node.id)}
    >
      {@render IndentGuides({ depth })}
      <ChevronRight
        data-folder-disclosure
        data-icon="inline-start"
        class={cn("transition-transform", expanded && "rotate-90")}
      />
      <Folder data-icon="inline-start" />
      <span class="min-w-0 flex-1 truncate text-left" data-folder-label
        >{node.label}</span
      >
      <span class="text-[10px] tabular-nums text-muted-foreground"
        >{node.count}</span
      >
    </Button>
    {#if expanded}
      <div
        class="flex min-w-0 flex-col gap-1"
        data-ledger-folder-children={node.id}
      >
        {#each node.files as file (file.path)}
          {@render LedgerFileRow({ file, depth })}
        {/each}
        {#each node.children as child (child.id)}
          {@render FolderNode({ node: child, depth: depth + 1 })}
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet TagTreeNode({
  node,
  depth = 0,
}: {
  node: LedgerTagTreeNode;
  depth?: number;
})}
  {@const expanded =
    node.children.length > 0 && isTagOpen(node.tag, tagOpenNodes)}
  <div class="flex min-w-0 flex-col gap-1" data-ledger-tag-node={node.tag}>
    <div
      class="relative flex min-w-0 items-center"
      style={tagRowStyle(depth)}
      data-ledger-tree-row
      data-active="false"
    >
      {@render IndentGuides({ depth })}
      {#if node.children.length > 0}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-tag-disclosure
          class="shrink-0 text-muted-foreground hover:bg-background hover:text-sidebar-foreground"
          aria-label={expanded
            ? `Collapse ${node.name}`
            : `Expand ${node.name}`}
          aria-expanded={expanded}
          title={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
          onclick={() => toggleTag(node.tag)}
        >
          <ChevronRight
            data-icon
            class={cn("transition-transform", expanded && "rotate-90")}
          />
        </Button>
      {/if}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="h-8 min-w-0 flex-1 justify-start gap-2 pr-1 text-xs text-muted-foreground hover:bg-background hover:text-sidebar-foreground"
        title={`#${node.tag}`}
        data-ledger-tag-row={node.tag}
        onclick={() => selectTag(node.tag)}
      >
        <Hash data-icon="inline-start" />
        <span class="min-w-0 flex-1 truncate text-left">{node.name}</span>
        <span class="text-[10px] tabular-nums">{node.count}</span>
      </Button>
    </div>
    {#if expanded}
      <div
        class="flex min-w-0 flex-col gap-1"
        data-ledger-tag-children={node.tag}
      >
        {#each node.children as child (child.tag)}
          {@render TagTreeNode({ node: child, depth: depth + 1 })}
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet IndentGuides({ depth }: { depth: number })}
  {#each indentGuideDepths(depth) as guideDepth (guideDepth)}
    <span
      aria-hidden="true"
      class="pointer-events-none absolute bottom-0 top-0 w-px bg-sidebar-border/70"
      style={indentGuideStyle(guideDepth)}
      data-ledger-indent-guide={guideDepth}
    ></span>
  {/each}
{/snippet}

<style>
  :global(.beancount-workspace-views) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
    gap: 0.25rem;
    padding: 0.25rem;
    border: 1px solid var(--sidebar-border, var(--border));
    border-radius: 0.375rem;
    background: color-mix(
      in srgb,
      var(--sidebar-accent, var(--accent)) 40%,
      transparent
    );
  }
  :global(.beancount-workspace-views [data-workspace-view][data-ui-part]) {
    height: 1.75rem;
    width: 100%;
    min-width: 0;
    padding: 0 0.25rem;
    font-size: 0.75rem;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    background: transparent;
    color: var(--muted-foreground);
  }
  :global(
      .beancount-workspace-views
        [data-ui-part][data-workspace-view][data-state="on"]
    ) {
    border-color: var(--sidebar-border, var(--border));
    background: var(--background);
    color: var(--sidebar-accent-foreground, var(--foreground));
    box-shadow: 0 1px 2px color-mix(in srgb, var(--foreground) 5%, transparent);
  }
  :global([data-ledger-settings-sidebar] [data-settings-disclosure]) {
    width: 1.5rem;
    height: 1.5rem;
    min-height: 0;
    margin-left: 0.25rem;
    padding: 0;
    flex: none;
    border: 0;
    background: transparent;
    box-shadow: none;
  }
  :global([data-ledger-settings-sidebar] [data-settings-group-label]) {
    height: 2rem;
    min-height: 0;
    padding: 0 0.25rem;
    gap: 0.5rem;
    justify-content: flex-start;
    font-size: 0.75rem;
  }
</style>
