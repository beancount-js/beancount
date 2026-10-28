import type {
  BeancountSidebarState,
  BeancountSidebarActions,
} from "./contracts";

/** Instance-owned navigation presentation; no implicit persistence. */
export function createSidebar() {
  let value = $state.raw<BeancountSidebarState>({
    mode: "workspace",
    view: "ledgers",
    tagsView: "tree",
    searches: { ledgers: "", folders: "", tags: "" },
    expanded: { files: {}, folders: {}, tags: {} },
    selectedTags: [],
    settings: false,
    settingsGroups: { import: true, review: true },
    projectFormOpen: false,
    projectPath: "",
    projectOpening: false,
    projectError: "",
  });
  function update(patch: Partial<BeancountSidebarState>) {
    value = { ...value, ...patch };
  }
  const actions: BeancountSidebarActions = {
    setMode(mode) {
      update({ mode });
    },
    setView(view) {
      update({ view });
    },
    setTagsView(tagsView) {
      update({ tagsView });
    },
    setSearch(view, query) {
      update({ searches: { ...value.searches, [view]: query } });
    },
    setExpanded(tree, id, expanded) {
      actions.setExpandedNodes(tree, {
        ...value.expanded[tree],
        [id]: expanded,
      });
    },
    setExpandedNodes(tree, nodes) {
      update({ expanded: { ...value.expanded, [tree]: { ...nodes } } });
    },
    toggleSettingsGroup(group) {
      update({
        settingsGroups: {
          ...value.settingsGroups,
          [group]: !value.settingsGroups[group],
        },
      });
    },
    beginProjectOpen() {
      update({ projectFormOpen: true, projectError: "" });
    },
    setProjectPath(projectPath) {
      update({ projectPath });
    },
    cancelProjectOpen() {
      if (!value.projectOpening)
        update({ projectFormOpen: false, projectPath: "", projectError: "" });
    },
  };
  return {
    get state() {
      return value;
    },
    actions,
    update,
  };
}
