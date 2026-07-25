<script lang="ts">
  import { onDestroy } from "svelte";
  import SharedRulesSettings from "@beancount-js/ui/pages/RulesSettings.svelte";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import { useStudioWorkspace } from "../studio/workspace";
  import { type DetectionRule } from "@beancount-js/beangulp";
  import { rulesJson, rulesPath } from "../rules/api";
  import type {
    RuleApplyPreviewResponse,
    RuleApplyResponse,
    RuleApplyTarget,
    RuleRun,
    RuleRunsResponse,
    RulesResponse,
  } from "../rules/types";

  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  const { snapshot } = useStudioWorkspace();

  const RUNS_LIMIT = 10;

  let rules = $state<DetectionRule[]>([]);
  let registry = $state<RulesResponse["registry"] | undefined>(undefined);
  let accounts = $state<string[]>([]);
  let runs = $state<RuleRun[]>([]);
  let runsTotal = $state(0);
  let runsOffset = $state(0);
  let loading = $state(false);
  let status = $state("");
  let loadedProjectId = $state("");
  let editingRule = $state<DetectionRule | null>(null);
  let editorOpen = $state(false);
  let applyBusy = $state(false);
  let applyOpen = $state(false);
  let applyPreviewLoading = $state(false);
  let applyRuleIds = $state<string[] | undefined>(undefined);
  let applyLabel = $state("");
  let applyTarget = $state<RuleApplyTarget>("live-ledger");
  let applyPreview = $state<RuleApplyPreviewResponse | null>(null);

  const project = $derived($snapshot);

  function message(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  function ruleName(rule: DetectionRule) {
    return rule.name?.trim() || "Untitled rule";
  }

  async function load() {
    if (!project || isWeb) return;
    loading = true;
    status = "";
    try {
      const response = await rulesJson<RulesResponse>(
        rulesPath(project.project.id),
      );
      rules = response.rules;
      registry = response.registry;
      accounts = response.accounts;
      loadedProjectId = project.project.id;
      runsOffset = 0;
      await loadRuns();
    } catch (error) {
      status = message(error);
    } finally {
      loading = false;
    }
  }

  async function loadRuns() {
    if (!project || isWeb) return;
    try {
      const response = await rulesJson<RuleRunsResponse>(
        rulesPath(
          project.project.id,
          `/runs?limit=${RUNS_LIMIT}&offset=${runsOffset}`,
        ),
      );
      runs = response.runs;
      runsTotal = response.total;
    } catch (error) {
      status = message(error);
    }
  }

  function changeRunsPage(nextOffset: number) {
    runsOffset = Math.max(0, nextOffset);
    void loadRuns();
  }

  async function saveRules(nextRules: DetectionRule[]) {
    if (!project) return;
    status = "Saving…";
    try {
      const response = await rulesJson<RulesResponse>(
        rulesPath(project.project.id),
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ version: 1, rules: nextRules }),
        },
      );
      rules = response.rules;
      status = "";
    } catch (error) {
      status = message(error);
    }
  }

  function openCreate() {
    editingRule = null;
    editorOpen = true;
  }

  function openEdit(rule: DetectionRule) {
    editingRule = rule;
    editorOpen = true;
  }

  function closeEditor() {
    editingRule = null;
  }

  function handleRuleSaved(next: DetectionRule) {
    const exists = rules.some((rule) => rule.id === next.id);
    const nextRules = exists
      ? rules.map((rule) => (rule.id === next.id ? next : rule))
      : [...rules, next];
    void saveRules(nextRules);
  }

  function toggleActive(rule: DetectionRule, active: boolean) {
    void saveRules(
      rules.map((item) => (item.id === rule.id ? { ...item, active } : item)),
    );
  }

  async function deleteRule(rule: DetectionRule) {
    if (
      !window.confirm(`Delete rule "${ruleName(rule)}"? This cannot be undone.`)
    ) {
      return;
    }
    await saveRules(rules.filter((item) => item.id !== rule.id));
  }

  async function loadApplyPreview() {
    if (!project || !applyOpen) return;
    applyPreviewLoading = true;
    try {
      const response = await rulesJson<RuleApplyPreviewResponse>(
        rulesPath(project.project.id, "/apply"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ruleIds: applyRuleIds,
            target: applyTarget,
            dryRun: true,
          }),
        },
      );
      applyPreview = response;
    } catch (error) {
      status = message(error);
      applyPreview = null;
    } finally {
      applyPreviewLoading = false;
    }
  }

  function openApply(rule?: DetectionRule) {
    if (!rule && !rules.some((item) => item.active)) {
      status = "No active rules to run.";
      return;
    }
    applyRuleIds = rule ? [rule.id] : undefined;
    applyLabel = rule ? `"${ruleName(rule)}"` : "all active rules";
    applyTarget = "live-ledger";
    applyPreview = null;
    applyOpen = true;
  }

  async function applySelectedRules() {
    if (!project) return;
    applyBusy = true;
    status = `Running ${applyLabel} on the ${
      applyTarget === "live-ledger"
        ? "live ledger"
        : applyTarget === "pending-imports"
          ? "pending imports"
          : "pending imports and the live ledger"
    }…`;
    try {
      await rulesJson<RuleApplyResponse>(rulesPath(project.project.id, "/apply"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ruleIds: applyRuleIds,
          target: applyTarget,
        }),
      });
      applyOpen = false;
      status = "Rules applied.";
      await loadRuns();
    } catch (error) {
      status = message(error);
    } finally {
      applyBusy = false;
    }
  }

  $effect(() => {
    const current = project;
    if (current && !isWeb && loadedProjectId !== current.project.id) {
      void load();
    }
  });

  $effect(() => {
    if (!applyOpen || !project) return;
    applyTarget;
    applyRuleIds;
    void loadApplyPreview();
  });

  $effect(() => {
    if (isWeb || !project) {
      ingestionHeaderActions.set(null);
      return;
    }
    ingestionHeaderActions.set({
      kind: "rules",
      saveHint: status,
      ruleCount: rules.length,
      canApplyAll: rules.some((rule) => rule.active),
      applyBusy,
      onApplyAll: () => {
        openApply();
      },
      onAddRule: openCreate,
    });
  });

  onDestroy(() => ingestionHeaderActions.set(null));
</script>

<SharedRulesSettings
  {isWeb}
  hasProject={Boolean(project)}
  {loading}
  {status}
  rules={rules}
  runs={runs}
  {runsOffset}
  {runsTotal}
  registry={registry}
  accounts={accounts}
  {applyBusy}
  {applyPreviewLoading}
  {applyRuleIds}
  {applyLabel}
  {applyTarget}
  {applyPreview}
  bind:applyOpen
  bind:editorOpen
  editingRule={editingRule}
  onToggleActive={toggleActive}
  onOpenEdit={openEdit}
  onOpenApply={openApply}
  onDeleteRule={deleteRule}
  onRunsPageChange={changeRunsPage}
  onApplyTargetChange={(target) => {
    applyTarget = target;
  }}
  onApply={applySelectedRules}
  onRuleSaved={handleRuleSaved}
  onEditorClosed={closeEditor}
/>
