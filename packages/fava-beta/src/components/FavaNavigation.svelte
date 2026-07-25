<script lang="ts">
  import ClipboardList from "lucide-svelte/icons/clipboard-list";
  import FileText from "lucide-svelte/icons/file-text";
  import Folder from "lucide-svelte/icons/folder";
  import Hash from "lucide-svelte/icons/hash";
  import History from "lucide-svelte/icons/history";
  import Landmark from "lucide-svelte/icons/landmark";
  import Palette from "lucide-svelte/icons/palette";
  import BookUser from "lucide-svelte/icons/book-user";
  import Store from "lucide-svelte/icons/store";
  import ShieldX from "lucide-svelte/icons/shield-x";
  import RefreshCw from "lucide-svelte/icons/refresh-cw";
  import Wand2 from "lucide-svelte/icons/wand-2";
  import { Query } from "@beancount-js/beancount";
  import type { FilterCommandOption } from "@beancount-js/ui/forms";
  import LedgerSettingsNavigation, {
    type LedgerSettingsNavigationItem,
  } from "@beancount-js/ui/navigation/LedgerSettingsNavigation.svelte";
  import LedgerWorkspaceNavigation from "@beancount-js/ui/navigation/LedgerWorkspaceNavigation.svelte";
  import type { WorkspaceTreeNavigationItem } from "@beancount-js/ui/navigation/WorkspaceTreeNavigation.svelte";
  import type { ProjectFile } from "@beancount-js/workspace";
  import { useContext } from "../context";
  import { type MenuItem } from "../menu";
  import { useNavigation } from "../router/router";
  import { useStudioWorkspace } from "../studio/workspace";
  import { DEFAULT_LEDGER_VIEW, ledgerStemForPath } from "../lib/ledger-route";
  import { setStudioRouteEnv } from "../lib/studio-route-env";
  import Search from "./Search.svelte";
  import { useLedger } from "./helpers";
  import {
    appendLedgerSearchParams,
    facetsToFilterQuery,
    parseLedgerSearchState,
  } from "../lib/ledger-search-state";
  import {
    collectExpandableLedgerFolderIds,
    createLedgerFolderTree,
    createLedgerTagSummaries,
    createLedgerTagTree,
    filterLedgerFiles,
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
  const { menu, ledgerSource, bqlQuery, query } = useContext();
  const ledgerData = useLedger();
  const { router } = useNavigation();
  const { activeRoute } = router;
  const { snapshot, activeFile, ledgerSidebarMode, reviewLedger } =
    useStudioWorkspace();

  let workspaceView: WorkspaceView = initialState.view ?? "ledgers";
  let searchOpen = false;
  let tagsViewMode: TagsViewMode = initialState.tagsViewMode ?? "tree";
  let folderOpenNodes = initialState.folderOpenNodes ?? {};
  let tagOpenNodes = initialState.tagOpenNodes ?? {};
  let expandedFilePaths: Record<string, boolean> = {};
  let selectedTags: string[] = [];
  /** Non-settings view to restore when leaving the settings sidebar. */
  let settingsReturnPath: string | undefined;
  let importSettingsOpen = true;
  let reviewSettingsOpen = true;
  /**
   * Prevents auto-open from fighting an intentional leave while the URL catches
   * up.
   */
  let closingSettings = false;

  $: files = $snapshot?.ledgerFiles ?? [];
  $: review = $reviewLedger;
  $: hasActiveReview = Boolean(review?.reviewableCount);
  $: allLedgerPaths = [
    ...files.map((file) => file.path),
    ...(review ? [review.path] : []),
  ];
  $: routeSearchTags = parseLedgerSearchState($activeRoute.query).tags;
  $: if (!tagsEqual(routeSearchTags, selectedTags)) {
    selectedTags = [...routeSearchTags];
  }
  $: selectedRouteLedger = $activeRoute.query["ledger"];
  $: if (
    selectedRouteLedger &&
    selectedRouteLedger !== $activeFile &&
    allLedgerPaths.includes(selectedRouteLedger)
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
  $: visibleLedgerFiles = filterLedgerFiles(files, "", selectedTags);
  $: folderTree = createLedgerFolderTree(filteredByTags);
  $: expandableFolderIds = folderTree
    ? collectExpandableLedgerFolderIds(folderTree)
    : [];
  $: tagTree = createLedgerTagTree(tagSummaries);
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
  $: queryPickerOptions = [
    { value: "all", label: "Select query" },
    ...queries.map((q) => ({
      value: q.value,
      label: q.label,
      keywords: [q.value],
    })),
  ] satisfies FilterCommandOption[];
  $: accountPickerOptions = [
    { value: "all", label: "Select account" },
    { value: "-", label: "All accounts", keywords: ["accounts"] },
    ...accounts.filter(
      (account, index, items) =>
        account.value !== "-" &&
        items.findIndex((item) => item.value === account.value) === index,
    ),
  ] satisfies FilterCommandOption[];
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
    const available = allLedgerPaths;
    setStudioRouteEnv({
      ledgerPath: path,
      ledgerStem: ledgerStemForPath(path, available),
      availableLedgers: available,
    });
  }

  function selectLedgerFile(path: string) {
    if (path === $activeFile) {
      toggleLedgerFile(path);
      return;
    }
    activateLedger(path);
    expandedFilePaths = { ...expandedFilePaths, [path]: true };
    router.push(DEFAULT_LEDGER_VIEW);
  }

  function openLedgerPanel(path: string, panel: MenuItem) {
    activateLedger(path);
    expandedFilePaths = { ...expandedFilePaths, [path]: true };
    router.push(panelViewPath(panel.path));
  }

  function isSettingsViewPath(routePath: string) {
    return (
      routePath === "/import/editor" ||
      routePath === "/import/accounts" ||
      routePath === "/import/merchants" ||
      routePath === "/import/manage-merchants" ||
      routePath === "/import/brands" ||
      routePath === "/import/history" ||
      routePath === "/import/rules" ||
      routePath === "/records"
    );
  }

  function rememberSettingsReturnPath(fromPath: string) {
    if (!isSettingsViewPath(fromPath)) {
      settingsReturnPath = fromPath;
    }
  }

  function closeLedgerSettings() {
    const target = settingsReturnPath ?? DEFAULT_LEDGER_VIEW;
    settingsReturnPath = undefined;
    closingSettings = true;
    ledgerSidebarMode.set("workspace");
    // Leaving a settings page must navigate away so the auto-open effect
    // does not immediately put the sidebar back into settings mode.
    if (isSettingsViewPath(activeViewPath)) {
      router.push(target);
    } else {
      closingSettings = false;
    }
  }

  function openLedgerSetting(panelPath: string) {
    const ledgerPath = selectedLedger?.path ?? files[0]?.path;
    if (!ledgerPath) return;
    rememberSettingsReturnPath(activeViewPath);
    closingSettings = false;
    activateLedger(ledgerPath);
    ledgerSidebarMode.set("settings");
    router.push(panelViewPath(panelPath));
  }

  function isLedgerSettingActive(panelPath: string, routePath: string) {
    return panelViewPath(panelPath) === routePath;
  }

  function panelViewPath(panelPath: string) {
    const raw = panelPath.replace(/^#/, "");
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return path.split("?")[0] || DEFAULT_LEDGER_VIEW;
  }

  function isPanelActive(panel: MenuItem, routePath: string) {
    return panelViewPath(panel.path) === routePath;
  }

  $: activeViewPath = $activeRoute.path;
  $: if (!isSettingsViewPath(activeViewPath)) {
    closingSettings = false;
  }
  $: if ($ledgerSidebarMode === "settings") {
    rememberSettingsReturnPath(activeViewPath);
  }
  // Opening settings from the shell only changes the sidebar state. Select the
  // first settings view so it always has a corresponding page.
  $: if (
    $ledgerSidebarMode === "settings" &&
    !isSettingsViewPath(activeViewPath)
  ) {
    router.push("/import/accounts");
  }
  $: if (
    isSettingsViewPath(activeViewPath) &&
    $ledgerSidebarMode !== "settings" &&
    !closingSettings
  ) {
    ledgerSidebarMode.set("settings");
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

  function isTagOpen(
    tag: string,
    openNodes: Record<string, boolean> = tagOpenNodes,
  ) {
    return openNodes[tag] ?? true;
  }

  function tagsEqual(left: string[], right: string[]) {
    if (left.length !== right.length) return false;
    const a = left.map((tag) => tag.toLowerCase()).sort();
    const b = right.map((tag) => tag.toLowerCase()).sort();
    return a.every((tag, index) => tag === b[index]);
  }

  function syncSearchTags(tags: string[]) {
    const route = $activeRoute;
    const params = new URLSearchParams(route.query);
    const state = parseLedgerSearchState(params);
    state.tags = tags.map((tag) => normalizeLedgerTag(tag)).filter(Boolean);
    appendLedgerSearchParams(params, state);
    query.set(facetsToFilterQuery(state));
    const search = params.toString();
    const path = route.path.replace(/\/$/, "") || "/";
    void router.updateState(search ? `${path}?${search}` : path);
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

  const navigationPanelSeparator = "\u0000";

  function navigationPanelId(filePath: string, panelPath: string) {
    return `${filePath}${navigationPanelSeparator}${panelPath}`;
  }

  function mapLedgerFile(file: ProjectFile): WorkspaceTreeNavigationItem {
    const active = file.path === $activeFile;
    return {
      id: file.path,
      label: ledgerFileLabel(file),
      icon: FileText,
      kind: "ledger-file",
      active,
      children: menuItems.map((panel) => ({
        id: navigationPanelId(file.path, panel.path),
        label: panel.name,
        icon: panel.icon,
        kind: "ledger-panel",
        active: active && isPanelActive(panel, activeViewPath),
      })),
    };
  }

  function mapFolderNode(node: LedgerFolderNode): WorkspaceTreeNavigationItem {
    return {
      id: node.id,
      label: node.label,
      badge: String(node.count),
      icon: Folder,
      kind: "ledger-folder",
      children: [
        ...node.files.map(mapLedgerFile),
        ...node.children.map(mapFolderNode),
      ],
    };
  }

  function mapTagNode(node: LedgerTagTreeNode): WorkspaceTreeNavigationItem {
    return {
      id: node.tag,
      label: node.name,
      badge: String(node.count),
      icon: Hash,
      kind: "ledger-tag",
      active: selectedTags.includes(node.tag),
      children: node.children.map(mapTagNode),
    };
  }

  function navigationLedgerFileIds(
    items: readonly WorkspaceTreeNavigationItem[],
  ): string[] {
    return items.flatMap((item) => [
      ...(item.kind === "ledger-file" ? [item.id] : []),
      ...navigationLedgerFileIds(item.children ?? []),
    ]);
  }

  function handleLedgerNavigationSelect(id: string) {
    const separatorIndex = id.indexOf(navigationPanelSeparator);
    if (separatorIndex < 0) {
      selectLedgerFile(id);
      return;
    }

    const filePath = id.slice(0, separatorIndex);
    const panelPath = id.slice(separatorIndex + 1);
    const panel = menuItems.find((item) => item.path === panelPath);
    if (panel) openLedgerPanel(filePath, panel);
  }

  function handleLedgerExpansion(ids: string[]) {
    const selected = new Set(ids);
    expandedFilePaths = Object.fromEntries(
      allLedgerPaths.map((path) => [path, selected.has(path)]),
    );
  }

  function handleFolderNavigationSelect(id: string) {
    const folder = findFolderNode(folderTree ?? undefined, id);
    if (folder) {
      toggleFolder(folder.id);
      return;
    }
    handleLedgerNavigationSelect(id);
  }

  function handleFolderExpansion(ids: string[]) {
    const selected = new Set(ids);
    folderOpenNodes = Object.fromEntries(
      expandableFolderIds.map((id) => [id, selected.has(id)]),
    );
    handleLedgerExpansion(ids);
  }

  function findFolderNode(
    node: LedgerFolderNode | undefined,
    id: string,
  ): LedgerFolderNode | undefined {
    if (!node) return undefined;
    if (node.id === id) return node;
    for (const child of node.children) {
      const match = findFolderNode(child, id);
      if (match) return match;
    }
    return undefined;
  }

  function activeNavigationItemId() {
    const selectedFile = selectedLedger?.path;
    if (!selectedFile) return undefined;
    const activePanel = menuItems.find((panel) =>
      isPanelActive(panel, activeViewPath),
    );
    return activePanel
      ? navigationPanelId(selectedFile, activePanel.path)
      : selectedFile;
  }

  $: ledgerNavigationItems = [
    ...visibleLedgerFiles.map(mapLedgerFile),
    ...(review && !selectedTags.length
      ? [
          {
            id: review.path,
            label: "Review transactions",
            badge: String(review.reviewableCount),
            icon: ClipboardList,
            kind: "ledger-file",
            active: review.path === $activeFile,
            children: menuItems.map((panel) => ({
              id: navigationPanelId(review.path, panel.path),
              label: panel.name,
              icon: panel.icon,
              kind: "ledger-panel",
              active:
                review.path === $activeFile &&
                isPanelActive(panel, activeViewPath),
            })),
          } satisfies WorkspaceTreeNavigationItem,
        ]
      : []),
  ] satisfies WorkspaceTreeNavigationItem[];
  $: folderNavigationItems = folderTree ? [mapFolderNode(folderTree)] : [];
  $: tagNavigationItems = tagTree.map(mapTagNode);
  $: ledgerExpandedIds = navigationLedgerFileIds(ledgerNavigationItems).filter(
    (id) => isFileExpanded(id, expandedFilePaths),
  );
  $: folderExpandedIds = [
    ...expandableFolderIds.filter((id) => isFolderOpen(id, folderOpenNodes)),
    ...navigationLedgerFileIds(folderNavigationItems).filter((id) =>
      isFileExpanded(id, expandedFilePaths),
    ),
  ];
  $: tagExpandedIds = tagTree
    .filter((node) => isTagOpen(node.tag))
    .map((node) => node.tag);
  $: settingsNavigationItems = [
    {
      id: "/import/accounts",
      label: "Accounts",
      icon: Landmark,
      active: isLedgerSettingActive("/import/accounts", activeViewPath),
      disabled: files.length === 0,
    },
    {
      id: "/import/editor",
      label: "Bank Sync",
      icon: RefreshCw,
      active: isLedgerSettingActive("/import/editor", activeViewPath),
      expanded: importSettingsOpen,
      disclosureLabel: "import",
      disabled: files.length === 0,
      children: [
        {
          id: "/import/history",
          label: "History",
          icon: History,
          active: isLedgerSettingActive("/import/history", activeViewPath),
          disabled: files.length === 0,
        },
        ...(hasActiveReview
          ? [
              {
                id: "/records",
                label: "Review",
                icon: ClipboardList,
                active: isLedgerSettingActive("/records", activeViewPath),
                groupActive:
                  isLedgerSettingActive("/records", activeViewPath) ||
                  isLedgerSettingActive("/import/merchants", activeViewPath),
                expanded: reviewSettingsOpen,
                disclosureLabel: "review",
                badge: String(review!.reviewableCount),
                badgeTitle: `${review!.reviewableCount} items in active review`,
                disabled: files.length === 0,
                children: [
                  {
                    id: "/import/merchants",
                    label: "Merchants",
                    icon: Store,
                    active: isLedgerSettingActive(
                      "/import/merchants",
                      activeViewPath,
                    ),
                    disabled: files.length === 0,
                  },
                ],
              } satisfies LedgerSettingsNavigationItem,
            ]
          : []),
      ],
    },
    {
      id: "/import/manage-merchants",
      label: "Merchants",
      icon: BookUser,
      active: isLedgerSettingActive("/import/manage-merchants", activeViewPath),
      disabled: files.length === 0,
    },
    {
      id: "/import/brands",
      label: "Brand match",
      icon: Palette,
      active: isLedgerSettingActive("/import/brands", activeViewPath),
      disabled: files.length === 0,
    },
    {
      id: "/import/rules",
      label: "Rules",
      icon: Wand2,
      active: isLedgerSettingActive("/import/rules", activeViewPath),
      disabled: files.length === 0,
    },
  ] satisfies LedgerSettingsNavigationItem[];

  function handleSettingsNavigationExpansion(id: string, expanded: boolean) {
    if (id === "/import/editor") importSettingsOpen = expanded;
    if (id === "/records") reviewSettingsOpen = expanded;
  }
</script>

{#snippet NavigationSearchContent()}
  <Search />
{/snippet}

<div class="cn-beta-components-favanavigation-633-1">
  {#if $ledgerSidebarMode === "settings"}
    <LedgerSettingsNavigation
      items={settingsNavigationItems}
      onBack={closeLedgerSettings}
      onSelect={openLedgerSetting}
      onExpandedChange={handleSettingsNavigationExpansion}
    />
  {:else}
    <LedgerWorkspaceNavigation
      ledgerItems={ledgerNavigationItems}
      folderItems={folderNavigationItems}
      tagItems={tagNavigationItems}
      ledgerCount={files.length}
      view={workspaceView}
      {searchOpen}
      treeVariant="ledger"
      tagsPresentation={tagsViewMode}
      activeLedgerId={activeNavigationItemId()}
      {ledgerExpandedIds}
      {folderExpandedIds}
      {tagExpandedIds}
      selectedTagIds={selectedTags}
      queryPicker={queries.length
        ? {
            label: "Query",
            value: $activeRoute.query["qs"] ?? "all",
            ariaLabel: "Select query",
            placeholder: "Filter queries...",
            options: queryPickerOptions,
          }
        : undefined}
      accountPicker={accounts.length
        ? {
            label: "Account",
            value: $activeRoute.params["account"] ?? "all",
            ariaLabel: "Select account",
            placeholder: "Filter accounts...",
            options: accountPickerOptions,
          }
        : undefined}
      resources={$snapshot?.resources.map((resource) => ({
        id: resource.path,
        label: resource.path,
      })) ?? []}
      onViewChange={(view) => {
        workspaceView = view;
      }}
      onSearchOpenChange={(open) => {
        searchOpen = open;
      }}
      onLedgerSelect={handleLedgerNavigationSelect}
      onLedgerExpandedIdsChange={handleLedgerExpansion}
      onFolderSelect={handleFolderNavigationSelect}
      onFolderExpandedIdsChange={handleFolderExpansion}
      onTagSelect={() => {}}
      onTagExpandedIdsChange={(ids) => {
        tagOpenNodes = Object.fromEntries(ids.map((id) => [id, true]));
      }}
      onSelectedTagIdsChange={syncSearchTags}
      onTagsPresentationChange={(presentation) => {
        tagsViewMode = presentation;
      }}
      onQueryChange={(value) => {
        if (value && value !== "all") navigateToQuery(value);
      }}
      onAccountChange={(value) => {
        navigateToAccount(value && value !== "all" ? value : "-");
      }}
      onResourceSelect={openResource}
      searchContent={NavigationSearchContent}
    />
  {/if}
</div>
