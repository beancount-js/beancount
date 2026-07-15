<script lang="ts">
  import ArrowLeft from "lucide-svelte/icons/arrow-left";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import FileText from "lucide-svelte/icons/file-text";
  import Folder from "lucide-svelte/icons/folder";
  import FolderTree from "lucide-svelte/icons/folder-tree";
  import Hash from "lucide-svelte/icons/hash";
  import ImportIcon from "lucide-svelte/icons/import";
  import Landmark from "lucide-svelte/icons/landmark";
  import List from "lucide-svelte/icons/list";
  import ListFilter from "lucide-svelte/icons/list-filter";
  import ShieldX from "lucide-svelte/icons/shield-x";
  import Sparkles from "lucide-svelte/icons/sparkles";
  import X from "lucide-svelte/icons/x";
  import { Query } from "@beancount-js/beancount";
  import type { ProjectFile } from "@beancount-js/workspace";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as ScrollArea from "$lib/components/ui/scroll-area";
  import { cn } from "$lib/utils";
  import { useContext } from "../context";
  import { accountIcon, type MenuItem } from "../menu";
  import { useNavigation } from "../router/router";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ledgerStemForPath } from "../lib/ledger-route";
  import { setStudioRouteEnv } from "../lib/studio-route-env";
  import ComboBox from "./ComboBox.svelte";
  import { useLedger } from "./helpers";
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

  type WorkspaceView = "ledgers" | "folders" | "tags";
  type TagsViewMode = "tree" | "flat";
  type StoredSidebarState = {
    view?: WorkspaceView;
    tagsViewMode?: TagsViewMode;
    folderOpenNodes?: Record<string, boolean>;
    tagOpenNodes?: Record<string, boolean>;
  };

  const SIDEBAR_STATE_STORAGE_KEY = "beancount-studio:ledger-sidebar";
  const initialState = readSidebarState();
  const { menu, ledgerSource, bqlQuery } = useContext();
  const ledgerData = useLedger();
  const { router } = useNavigation();
  const { activeRoute } = router;
  const { snapshot, activeFile, ledgerSidebarMode } = useStudioWorkspace();

  let workspaceView: WorkspaceView = initialState.view ?? "ledgers";
  let tagsViewMode: TagsViewMode = initialState.tagsViewMode ?? "tree";
  let folderOpenNodes = initialState.folderOpenNodes ?? {};
  let tagOpenNodes = initialState.tagOpenNodes ?? {};
  let expandedFilePaths: Record<string, boolean> = {};
  let ledgerQuery = "";
  let folderQuery = "";
  let tagQuery = "";
  let selectedTags: string[] = [];

  $: files = $snapshot?.ledgerFiles ?? [];
  $: selectedRouteLedger = $activeRoute.query["ledger"];
  $: if (
    selectedRouteLedger &&
    selectedRouteLedger !== $activeFile &&
    files.some((file) => file.path === selectedRouteLedger)
  ) {
    activeFile.set(selectedRouteLedger);
    expandedFilePaths = { ...expandedFilePaths, [selectedRouteLedger]: true };
  }
  $: selectedLedger = files.find((file) => file.path === $activeFile);
  $: if (
    $ledgerSidebarMode === "settings" &&
    selectedLedger &&
    !isFileExpanded(selectedLedger.path)
  ) {
    expandedFilePaths = {
      ...expandedFilePaths,
      [selectedLedger.path]: true,
    };
  }
  $: menuItems = getMenu();
  $: tagSummaries = createLedgerTagSummaries(files);
  $: filteredByTags = filterLedgerFiles(files, "", selectedTags);
  $: visibleLedgerFiles = filterLedgerFiles(files, ledgerQuery, selectedTags);
  $: folderTree = filterLedgerFolderTree(
    createLedgerFolderTree(filteredByTags),
    folderQuery,
  );
  $: expandableFolderIds = folderTree
    ? collectExpandableLedgerFolderIds(folderTree)
    : [];
  $: hasCollapsedFolders = expandableFolderIds.some(
    (id) => !isFolderOpen(id, folderOpenNodes),
  );
  $: filteredTags = filterLedgerTagsByPathMatch(tagSummaries, tagQuery);
  $: tagTree = createLedgerTagTree(filteredTags);
  $: queries = $ledgerSource.directives
    .filter((directive) => directive instanceof Query)
    .map((directive) => ({
      label: directive.name,
      value: directive.query,
    }));
  $: ledgerAccounts = [
    ...new Set(
      $ledgerData.directives
        .map((directive) => directive.accounts)
        .flat()
        .filter((account) => account.length > 0),
    ),
  ];
  $: accounts = ledgerAccounts.map((account) => ({
    label: account,
    value: account,
  }));
  $: accountGroups = {
    group: "Accounts",
    items: [
      { label: "All", value: "-" },
      ...[...new Set(ledgerAccounts.map((account) => account.split(":", 2)[0]))]
        .filter(Boolean)
        .map((account) => ({
          label: account,
          value: account,
          icon: accountIcon(account),
        })),
    ],
  };
  $: if (typeof localStorage !== "undefined") {
    localStorage.setItem(
      SIDEBAR_STATE_STORAGE_KEY,
      JSON.stringify({
        view: workspaceView,
        tagsViewMode,
        folderOpenNodes,
        tagOpenNodes,
      } satisfies StoredSidebarState),
    );
  }

  function readSidebarState(): StoredSidebarState {
    if (typeof localStorage === "undefined") return {};
    try {
      const value = JSON.parse(
        localStorage.getItem(SIDEBAR_STATE_STORAGE_KEY) ?? "{}",
      ) as StoredSidebarState;
      return {
        view: ["ledgers", "folders", "tags"].includes(value.view ?? "")
          ? value.view
          : undefined,
        tagsViewMode: ["tree", "flat"].includes(value.tagsViewMode ?? "")
          ? value.tagsViewMode
          : undefined,
        folderOpenNodes: value.folderOpenNodes ?? {},
        tagOpenNodes: value.tagOpenNodes ?? {},
      };
    } catch {
      return {};
    }
  }

  function getMenu() {
    const items: MenuItem[] = [];
    $menu.forEach((group) => items.push(...group));
    if ($ledgerData.errors.length) {
      items.push({
        name: "Errors",
        path: "/errors",
        icon: ShieldX,
      });
    }
    return items;
  }

  function isFileExpanded(
    path: string,
    expandedPaths: Record<string, boolean> = expandedFilePaths,
  ) {
    if (Object.hasOwn(expandedPaths, path)) {
      return expandedPaths[path]!;
    }
    return path === $activeFile;
  }

  function toggleLedgerFile(path: string) {
    expandedFilePaths = {
      ...expandedFilePaths,
      [path]: !isFileExpanded(path),
    };
  }

  function activateLedger(path: string) {
    activeFile.set(path);
    const available = files.map((file) => file.path);
    setStudioRouteEnv({
      ledgerPath: path,
      ledgerStem: ledgerStemForPath(path, available),
      availableLedgers: available,
    });
  }

  function selectLedgerFile(path: string) {
    activateLedger(path);
    expandedFilePaths = { ...expandedFilePaths, [path]: true };
    router.push("/journal");
  }

  function openLedgerPanel(path: string, panel: MenuItem) {
    activateLedger(path);
    expandedFilePaths = { ...expandedFilePaths, [path]: true };
    router.push(panelViewPath(panel.path));
  }

  function closeLedgerSettings() {
    ledgerSidebarMode.set("workspace");
  }

  function openLedgerSetting(panelPath: string) {
    const ledgerPath = selectedLedger?.path ?? files[0]?.path;
    if (!ledgerPath) return;
    activateLedger(ledgerPath);
    router.push(panelViewPath(panelPath));
  }

  function isLedgerSettingActive(panelPath: string) {
    return panelViewPath(panelPath) === $activeRoute.path;
  }

  function panelViewPath(panelPath: string) {
    const raw = panelPath.replace(/^#/, "");
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return path.split("?")[0] || "/journal";
  }

  function isPanelActive(panel: MenuItem, routePath: string) {
    return panelViewPath(panel.path) === routePath;
  }

  function expandAllFiles() {
    expandedFilePaths = Object.fromEntries(
      visibleLedgerFiles.map((file) => [file.path, true]),
    );
  }

  function collapseAllFiles() {
    expandedFilePaths = Object.fromEntries(
      visibleLedgerFiles.map((file) => [file.path, false]),
    );
  }

  function hasCollapsedFiles() {
    return visibleLedgerFiles.some((file) => !isFileExpanded(file.path));
  }

  function toggleAllFiles() {
    if (hasCollapsedFiles()) expandAllFiles();
    else collapseAllFiles();
  }

  function isFolderOpen(
    id: string,
    openNodes: Record<string, boolean> = folderOpenNodes,
  ) {
    if (Object.hasOwn(openNodes, id)) return openNodes[id]!;
    return ledgerFolderAncestorIds($activeFile).includes(id);
  }

  function toggleFolder(id: string) {
    folderOpenNodes = {
      ...folderOpenNodes,
      [id]: !isFolderOpen(id, folderOpenNodes),
    };
  }

  function toggleAllFolders() {
    folderOpenNodes = Object.fromEntries(
      expandableFolderIds.map((id) => [id, hasCollapsedFolders]),
    );
  }

  function isTagOpen(
    tag: string,
    openNodes: Record<string, boolean> = tagOpenNodes,
  ) {
    return openNodes[tag] ?? true;
  }

  function toggleTag(tag: string) {
    tagOpenNodes = {
      ...tagOpenNodes,
      [tag]: !isTagOpen(tag, tagOpenNodes),
    };
  }

  function selectTag(tag: string) {
    const normalized = normalizeLedgerTag(tag);
    if (!normalized) return;
    if (
      !selectedTags.some(
        (selected) => selected.toLowerCase() === normalized.toLowerCase(),
      )
    ) {
      selectedTags = [...selectedTags, normalized];
    }
    workspaceView = "ledgers";
  }

  function removeTag(tag: string) {
    const normalized = normalizeLedgerTag(tag).toLowerCase();
    selectedTags = selectedTags.filter(
      (selected) => normalizeLedgerTag(selected).toLowerCase() !== normalized,
    );
  }

  function navigateToAccount(account: string) {
    if (!account) return;
    router.push(account === "-" ? "/accounts" : `/account/${account}`);
  }

  function navigateToQuery(query: string) {
    if (!query) return;
    bqlQuery.set(query);
    router.push(`/query?qs=${encodeURIComponent(query)}`);
  }

  function openResource(path: string) {
    router.push(`/resource?path=${encodeURIComponent(path)}`);
  }

  function fileRowStyle(depth: number) {
    return `padding-left: ${0.25 + Math.max(depth, 0) * 0.875}rem`;
  }

  function filePanelStyle(depth: number) {
    return `padding-left: ${2 + Math.max(depth, 0) * 0.875}rem`;
  }

  function folderRowStyle(depth: number) {
    return `padding-left: ${0.25 + Math.max(depth, 0) * 0.875}rem`;
  }

  function tagRowStyle(depth: number) {
    return `padding-left: ${0.25 + Math.max(depth, 0) * 0.875}rem`;
  }

  function indentGuideDepths(depth: number) {
    return Array.from({ length: Math.max(depth, 0) }, (_, index) => index);
  }

  function indentGuideStyle(depth: number) {
    return `left: ${0.75 + depth * 0.875}rem`;
  }
</script>

<div class="flex min-h-0 flex-1 flex-col gap-3">
  {#if $ledgerSidebarMode === "settings"}
    <div
      class="flex min-h-0 flex-1 flex-col gap-3"
      data-ledger-settings-sidebar
    >
      <div class="flex items-center gap-2 px-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-7 shrink-0"
          aria-label="Back to ledger navigation"
          title="Back to ledger navigation"
          onclick={closeLedgerSettings}
        >
          <ArrowLeft />
        </Button>
        <div class="min-w-0">
          <p class="text-xs font-medium uppercase text-muted-foreground">
            Settings
          </p>
        </div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class={cn(
            "h-auto w-full justify-start gap-2 px-2 py-2 text-left",
            isLedgerSettingActive("/import/editor") ||
              isLedgerSettingActive("/records")
              ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
              : "text-muted-foreground hover:bg-background hover:text-sidebar-foreground",
          )}
          aria-current={isLedgerSettingActive("/import/editor") ||
          isLedgerSettingActive("/records")
            ? "page"
            : undefined}
          disabled={files.length === 0}
          onclick={() => openLedgerSetting("/import/editor")}
        >
          <ImportIcon data-icon="inline-start" />
          <span class="min-w-0 flex-1">
            <span class="block text-xs font-medium">Import</span>
            <span class="block truncate text-[11px] text-muted-foreground"
              >Configure sources and review imports</span
            >
          </span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class={cn(
            "h-auto w-full justify-start gap-2 px-2 py-2 text-left",
            isLedgerSettingActive("/import/accounts")
              ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
              : "text-muted-foreground hover:bg-background hover:text-sidebar-foreground",
          )}
          aria-current={isLedgerSettingActive("/import/accounts")
            ? "page"
            : undefined}
          disabled={files.length === 0}
          onclick={() => openLedgerSetting("/import/accounts")}
        >
          <Landmark data-icon="inline-start" />
          <span class="min-w-0 flex-1">
            <span class="block text-xs font-medium">Accounts</span>
            <span class="block truncate text-[11px] text-muted-foreground"
              >Link bank accounts from connected providers</span
            >
          </span>
        </Button>
      </div>
    </div>
  {:else}
    <div class="flex items-center justify-between gap-2 px-2">
      <p class="text-xs font-medium uppercase text-muted-foreground">Ledgers</p>
      <span class="text-xs tabular-nums text-muted-foreground"
        >{files.length}</span
      >
    </div>

    <div
      class="grid grid-cols-3 gap-1 rounded-md border border-sidebar-border bg-sidebar-accent/40 p-1"
      aria-label="Ledger navigation views"
    >
      {#each [{ id: "ledgers", label: "Ledgers" }, { id: "folders", label: "Folders" }, { id: "tags", label: "Tags" }] as view (view.id)}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class={cn(
            "h-7 text-xs",
            workspaceView === view.id
              ? "border border-sidebar-border bg-background shadow-sm hover:bg-background"
              : "hover:bg-background",
          )}
          aria-pressed={workspaceView === view.id}
          onclick={() => (workspaceView = view.id as WorkspaceView)}
        >
          {view.label}
        </Button>
      {/each}
    </div>

    {#if workspaceView === "ledgers"}
      <div class="flex items-center gap-1">
        <label class="relative min-w-0 flex-1">
          <ListFilter
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            bind:value={ledgerQuery}
            placeholder="Search ledgers"
            class="h-8 bg-sidebar pl-8 text-xs"
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-7"
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

      {#if selectedTags.length}
        <div
          class="flex flex-wrap items-center gap-1 rounded-md border border-sidebar-border bg-background/55 p-1.5 text-xs text-muted-foreground"
          aria-label="Selected tag filters"
        >
          {#each selectedTags as tag (tag)}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="h-6 max-w-full gap-1 rounded-full px-2 text-[11px] text-primary hover:bg-primary/10"
              aria-label={`Remove #${tag} filter`}
              onclick={() => removeTag(tag)}
            >
              <Hash data-icon="inline-start" />
              <span class="truncate">{tag}</span>
              <X data-icon="inline-end" />
            </Button>
          {/each}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="ml-auto h-6 px-2 text-[11px]"
            onclick={() => (selectedTags = [])}
          >
            Clear
          </Button>
        </div>
      {/if}

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

          {#if queries.length || accounts.length || $snapshot?.resources.length}
            <div
              class="mt-2 flex flex-col gap-2 border-t border-sidebar-border pt-3"
            >
              <p
                class="px-2 text-xs font-medium uppercase text-muted-foreground"
              >
                Ledger tools
              </p>
              {#if queries.length}
                <ComboBox
                  items={queries}
                  placeholder="Select query"
                  value={$activeRoute.query["qs"] ?? ""}
                  onValueChange={navigateToQuery}
                >
                  {#snippet trigger({ props, value: label, hasSelection })}
                    <Button
                      {...props}
                      size="sm"
                      variant="ghost"
                      role="combobox"
                      class="w-full justify-start"
                    >
                      <span
                        class="truncate"
                        class:text-muted-foreground={!hasSelection}
                        >{label}</span
                      >
                    </Button>
                  {/snippet}
                </ComboBox>
              {/if}
              {#if accounts.length}
                <ComboBox
                  items={accounts}
                  groups={[accountGroups]}
                  value={$activeRoute.params["account"] ?? ""}
                  placeholder="Select account"
                  onValueChange={navigateToAccount}
                >
                  {#snippet trigger({ props, value: label, hasSelection })}
                    <Button
                      {...props}
                      size="sm"
                      variant="ghost"
                      role="combobox"
                      class="w-full justify-start"
                    >
                      <span
                        class="truncate"
                        class:text-muted-foreground={!hasSelection}
                        >{label}</span
                      >
                    </Button>
                  {/snippet}
                </ComboBox>
              {/if}
              {#each $snapshot?.resources ?? [] as resource (resource.path)}
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
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            bind:value={folderQuery}
            placeholder="Search folders"
            class="h-8 bg-sidebar pl-8 text-xs"
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="size-7"
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
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            bind:value={tagQuery}
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
            (tagsViewMode = tagsViewMode === "tree" ? "flat" : "tree")}
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
  {@const active = file.path === $activeFile}
  {@const label = ledgerFileLabel(file)}
  <div class="min-w-0" data-ledger-file-node={file.path}>
    <div
      class={cn(
        "relative flex h-8 min-w-0 items-center rounded-md text-xs font-semibold transition-colors",
        "text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
      )}
      style={fileRowStyle(depth)}
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
      <div class="min-w-0" data-ledger-file-panels={file.path}>
        {#each menuItems as panel (panel.path)}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class={cn(
              "relative h-8 w-full justify-start rounded-md pr-2 text-xs",
              active && isPanelActive(panel, $activeRoute.path)
                ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
                : "text-muted-foreground hover:bg-background hover:text-sidebar-foreground",
            )}
            style={filePanelStyle(depth)}
            aria-current={active && isPanelActive(panel, $activeRoute.path)
              ? "page"
              : undefined}
            onclick={() => openLedgerPanel(file.path, panel)}
          >
            {@render IndentGuides({ depth: depth + 1 })}
            <svelte:component this={panel.icon} data-icon="inline-start" />
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
  <div class="min-w-0" data-ledger-folder-node={node.id}>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class="relative h-8 w-full min-w-0 justify-start gap-1 pr-1 text-xs text-sidebar-foreground hover:bg-background hover:text-sidebar-accent-foreground"
      style={folderRowStyle(depth)}
      aria-expanded={expanded}
      title={node.path || "Ledgers"}
      data-ledger-folder-row={node.path || "ledgers"}
      onclick={() => toggleFolder(node.id)}
    >
      {@render IndentGuides({ depth })}
      <ChevronRight
        data-icon="inline-start"
        class={cn("transition-transform", expanded && "rotate-90")}
      />
      <Folder data-icon="inline-start" />
      <span class="min-w-0 flex-1 truncate text-left">{node.label}</span>
      <span class="text-[10px] tabular-nums text-muted-foreground"
        >{node.count}</span
      >
    </Button>
    {#if expanded}
      <div class="min-w-0" data-ledger-folder-children={node.id}>
        {#each node.files as file (file.path)}
          {@render LedgerFileRow({ file, depth: depth + 1 })}
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
  <div class="min-w-0" data-ledger-tag-node={node.tag}>
    <div
      class="relative flex min-w-0 items-center gap-1"
      style={tagRowStyle(depth)}
    >
      {@render IndentGuides({ depth })}
      {#if node.children.length > 0}
        <Button
          type="button"
          variant="ghost"
          size="icon"
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
      <div class="min-w-0" data-ledger-tag-children={node.tag}>
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
