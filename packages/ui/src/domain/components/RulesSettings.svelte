<script lang="ts">
  import { rowOpen } from "../lib/row-open";
  import { ArrowDownWideNarrow } from "@lucide/svelte";
  import { ArrowUpDown } from "@lucide/svelte";
  import { ArrowUpNarrowWide } from "@lucide/svelte";
  import { FileCode2 } from "@lucide/svelte";
  import { ListFilter } from "@lucide/svelte";
  import { MoreHorizontal } from "@lucide/svelte";
  import { Pencil } from "@lucide/svelte";
  import { Play } from "@lucide/svelte";
  import { Trash2 } from "@lucide/svelte";
  import { summarizeRule, type DetectionRule } from "@beancount-js/beangulp";
  import { onDestroy } from "svelte";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import { Switch } from "@lapismd/design-core/shadcn/switch";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";
  import { cn } from "../lib/utils";
  import type { SortOrder } from "../grid/sort";
  import { useIngestionHeaderActions } from "../studio/ingestion-header-actions";
  const ingestionHeaderActions = useIngestionHeaderActions();
  import { useStudioWorkspace } from "../studio/workspace";
  import { useRulesApi, rulesPath } from "../rules/api";
  const { rulesJson } = useRulesApi();
  import type {
    RuleApplyPreviewResponse,
    RuleApplyResponse,
    RuleApplyTarget,
    RuleRun,
    RuleRunsResponse,
    RulesResponse,
  } from "../rules/types";
  import PagePagination from "./PagePagination.svelte";
  import RuleEditorSheet from "./RuleEditorSheet.svelte";
  import RulesPageSkeleton from "./skeletons/RulesPageSkeleton.svelte";

  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  const { snapshot } = useStudioWorkspace();

  const RUNS_LIMIT = 10;
  const SORT_CYCLE: Record<SortOrder, SortOrder> = {
    none: "asc",
    asc: "desc",
    desc: "none",
  };

  type SortKey = "name" | "active";

  let rules = $state<DetectionRule[]>([]);
  let registry = $state<RulesResponse["registry"] | undefined>(undefined);
  let accounts = $state<string[]>([]);
  let runs = $state<RuleRun[]>([]);
  let runsTotal = $state(0);
  let runsOffset = $state(0);
  let loading = $state(false);
  let status = $state("");
  let sortOrders = $state<Record<SortKey, SortOrder>>({
    name: "asc",
    active: "none",
  });
  /** Order sorts were added; earlier entries are primary. */
  let sortPriority = $state<SortKey[]>(["name"]);
  let loadedProjectId = $state("");
  let editorOpen = $state(false);
  let editingRule = $state<DetectionRule | null>(null);
  let applyBusy = $state(false);
  let applyOpen = $state(false);
  let applyPreviewLoading = $state(false);
  let applyRuleIds = $state<string[] | undefined>(undefined);
  let applyLabel = $state("");
  let applyTarget = $state<RuleApplyTarget>("live-ledger");
  let applyPreview = $state<RuleApplyPreviewResponse["preview"]>([]);

  const project = $derived($snapshot);
  const sortedRules = $derived.by(() => {
    const keys = sortPriority.filter((key) => sortOrders[key] !== "none");
    if (!keys.length) return rules;
    const next = [...rules];
    next.sort((left, right) => {
      for (const key of keys) {
        const direction = sortOrders[key] === "asc" ? 1 : -1;
        const cmp =
          key === "name"
            ? compareNames(left, right)
            : Number(left.active) - Number(right.active);
        if (cmp !== 0) return direction * cmp;
      }
      return 0;
    });
    return next;
  });
  const runsPage = $derived(Math.floor(runsOffset / RUNS_LIMIT) + 1);
  const runsPageCount = $derived(
    Math.max(1, Math.ceil(runsTotal / RUNS_LIMIT)),
  );

  function compareNames(left: DetectionRule, right: DetectionRule) {
    return (left.name ?? "Untitled rule").localeCompare(
      right.name ?? "Untitled rule",
      undefined,
      { sensitivity: "base" },
    );
  }

  function cycleSort(key: SortKey) {
    const next = SORT_CYCLE[sortOrders[key]];
    sortOrders = { ...sortOrders, [key]: next };
    if (next === "none") {
      sortPriority = sortPriority.filter((item) => item !== key);
    } else if (!sortPriority.includes(key)) {
      sortPriority = [...sortPriority, key];
    }
  }

  function ariaSortFor(key: SortKey): "ascending" | "descending" | "none" {
    const order = sortOrders[key];
    if (order === "none") return "none";
    return order === "asc" ? "ascending" : "descending";
  }

  function message(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  function ruleName(rule: DetectionRule) {
    return rule.name?.trim() || "Untitled rule";
  }

  function formatDateTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function statusPillClass(status: RuleRun["status"]) {
    if (status === "success") {
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    }
    if (status === "failed") {
      return "bg-red-500/15 text-red-600 dark:text-red-400";
    }
    return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
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

  function targetLabel(target: RuleApplyTarget) {
    if (target === "live-ledger") return "live ledger";
    if (target === "pending-imports") return "pending imports";
    return "pending imports and the live ledger";
  }

  function previewTotals(entries: RuleApplyPreviewResponse["preview"]) {
    return entries.reduce(
      (totals, entry) => ({
        pendingImports: totals.pendingImports + entry.pendingImports,
        liveLedger: totals.liveLedger + entry.liveLedger,
        total: totals.total + entry.total,
      }),
      { pendingImports: 0, liveLedger: 0, total: 0 },
    );
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
      applyPreview = response.preview;
    } catch (error) {
      status = message(error);
      applyPreview = [];
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
    applyPreview = [];
    applyOpen = true;
  }

  async function applySelectedRules() {
    if (!project) return;
    applyBusy = true;
    status = `Running ${applyLabel} on the ${targetLabel(applyTarget)}…`;
    try {
      await rulesJson<RuleApplyResponse>(
        rulesPath(project.project.id, "/apply"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ruleIds: applyRuleIds,
            target: applyTarget,
          }),
        },
      );
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

<section class="h-full overflow-y-auto p-4 sm:p-6" data-rules-settings>
  <div class="mx-auto flex w-full max-w-4xl flex-col gap-6">
    {#if isWeb}
      <Alert.Root>
        <FileCode2 />
        <Alert.Title>Local server required</Alert.Title>
        <Alert.Description
          >Detection rules are available only through the local server.</Alert.Description
        >
      </Alert.Root>
    {:else if !project}
      <Empty.Root class="min-h-64 border">
        <Empty.Header>
          <Empty.Media variant="icon"><ListFilter /></Empty.Media>
          <Empty.Title>Open a project</Empty.Title>
          <Empty.Description
            >Open a project to configure detection rules.</Empty.Description
          >
        </Empty.Header>
      </Empty.Root>
    {:else}
      {#if loading && !rules.length}
        <RulesPageSkeleton />
      {:else if !rules.length}
        <Empty.Root class="min-h-48 border">
          <Empty.Header>
            <Empty.Media variant="icon"><ListFilter /></Empty.Media>
            <Empty.Title>No detection rules yet</Empty.Title>
            <Empty.Description
              >Add a rule to automatically categorize, tag, or exclude matching
              transactions.</Empty.Description
            >
          </Empty.Header>
        </Empty.Root>
      {:else}
        <div
          role="group"
          class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl bg-muted px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          <div
            role="group"
            data-sort-direction={ariaSortFor("name")}
            class="justify-self-start"
          >
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Sort by rule name; sort direction: ${ariaSortFor("name")}`}
              onclick={() => cycleSort("name")}
            >
              Rule
              {#if sortOrders.name === "asc"}
                <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
              {:else if sortOrders.name === "desc"}
                <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
              {:else}
                <ArrowUpDown class="size-3.5 opacity-50" aria-hidden="true" />
              {/if}
            </button>
          </div>
          <div
            role="group"
            data-sort-direction={ariaSortFor("active")}
            class="justify-self-end"
          >
            <button
              type="button"
              class="inline-flex items-center justify-end gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Sort by active status; sort direction: ${ariaSortFor("active")}`}
              onclick={() => cycleSort("active")}
            >
              Active
              {#if sortOrders.active === "asc"}
                <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
              {:else if sortOrders.active === "desc"}
                <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
              {:else}
                <ArrowUpDown class="size-3.5 opacity-50" aria-hidden="true" />
              {/if}
            </button>
          </div>
          <div role="group" aria-hidden="true"></div>
        </div>
        <div class="overflow-hidden rounded-xl border bg-card shadow-sm">
          {#each sortedRules as rule, index (rule.id)}
            {@const summary = summarizeRule(rule)}
            <div
              role="group"
              class:rounded-b-xl={index === sortedRules.length - 1}
              class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b px-4 py-3 outline-none transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Edit rule ${ruleName(rule)}`}
              use:rowOpen={() => openEdit(rule)}
            >
              <div class="min-w-0">
                <button
                  type="button"
                  class="text-left text-sm font-semibold hover:underline focus-visible:outline focus-visible:outline-ring"
                  aria-label={`Edit rule ${ruleName(rule)}`}
                  onclick={() => openEdit(rule)}>{ruleName(rule)}</button
                >
                <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    class="max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    title={summary.if}
                    ><span class="font-semibold text-foreground/80">IF</span>
                    {summary.if}</span
                  >
                  <span
                    class="max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    title={summary.then}
                    ><span class="font-semibold text-foreground/80">THEN</span>
                    {summary.then}</span
                  >
                  <span
                    class="max-w-full truncate rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    title={summary.for}
                    ><span class="font-semibold text-foreground/80">FOR</span>
                    {summary.for}</span
                  >
                </div>
              </div>

              <Switch
                checked={rule.active}
                aria-label={rule.active ? "Deactivate rule" : "Activate rule"}
                onclick={(event) => event.stopPropagation()}
                onCheckedChange={(checked) => toggleActive(rule, checked)}
              />

              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  {#snippet child({ props })}
                    <Button
                      {...props}
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="size-8 shrink-0"
                      aria-label="Rule actions"
                      onclick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <MoreHorizontal class="size-4" />
                    </Button>
                  {/snippet}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Item onSelect={() => openEdit(rule)}>
                    <Pencil class="size-3.5" aria-hidden="true" />
                    Edit
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    disabled={applyBusy}
                    onSelect={() => openApply(rule)}
                  >
                    <Play class="size-3.5" aria-hidden="true" />
                    Run…
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    class="text-destructive focus:text-destructive"
                    onSelect={() => void deleteRule(rule)}
                  >
                    <Trash2 class="size-3.5" aria-hidden="true" />
                    Delete
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          {/each}
        </div>
      {/if}

      <div class="flex flex-col gap-3">
        <h2
          class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Recent runs
        </h2>
        {#if !runs.length}
          <p class="text-sm text-muted-foreground">No rule runs yet.</p>
        {:else}
          <div class="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table class="w-full min-w-[42rem] text-left text-sm">
              <thead>
                <tr
                  class="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  <th class="px-4 py-2.5 font-semibold">Date/Time</th>
                  <th class="px-4 py-2.5 font-semibold">Type</th>
                  <th class="px-4 py-2.5 font-semibold">Status</th>
                  <th class="px-4 py-2.5 font-semibold">Rule</th>
                  <th class="px-4 py-2.5 text-right font-semibold">Queued</th>
                  <th class="px-4 py-2.5 text-right font-semibold">Processed</th
                  >
                  <th class="px-4 py-2.5 text-right font-semibold">Modified</th>
                  <th class="px-4 py-2.5 text-right font-semibold">Blocked</th>
                </tr>
              </thead>
              <tbody>
                {#each runs as run (run.id)}
                  <tr class="border-b last:border-b-0">
                    <td
                      class="whitespace-nowrap px-4 py-2.5 text-muted-foreground"
                      >{formatDateTime(run.executedAt)}</td
                    >
                    <td class="px-4 py-2.5 capitalize text-muted-foreground"
                      >{run.executionType}</td
                    >
                    <td class="px-4 py-2.5">
                      <span
                        class={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          statusPillClass(run.status),
                        )}
                        title={run.errorMessage ?? undefined}>{run.status}</span
                      >
                    </td>
                    <td
                      class="min-w-0 max-w-52 truncate px-4 py-2.5 font-medium"
                      >{run.ruleName}</td
                    >
                    <td class="px-4 py-2.5 text-right tabular-nums"
                      >{run.transactionsQueued}</td
                    >
                    <td class="px-4 py-2.5 text-right tabular-nums"
                      >{run.transactionsProcessed}</td
                    >
                    <td class="px-4 py-2.5 text-right tabular-nums"
                      >{run.transactionsModified}</td
                    >
                    <td class="px-4 py-2.5 text-right tabular-nums"
                      >{run.transactionsBlocked}</td
                    >
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          {#if runsPageCount > 1}
            <div
              class="flex flex-col items-stretch gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              data-rule-run-pagination
            >
              <span class="text-sm text-muted-foreground"
                >Page {runsPage} of {runsPageCount}</span
              >
              <PagePagination
                page={runsPage}
                pageCount={runsPageCount}
                ariaLabel="Rule run pages"
                disabled={loading}
                onPageChange={(nextPage) =>
                  changeRunsPage((nextPage - 1) * RUNS_LIMIT)}
              />
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
</section>

{#if project}
  <Dialog.Root bind:open={applyOpen}>
    <Dialog.Content class="sm:max-w-xl">
      <Dialog.Header>
        <Dialog.Title>Run rules</Dialog.Title>
        <Dialog.Description>
          Choose where to run {applyLabel}. Running rules from this page is a
          bulk-fix operation; it does not change ingestion automation.
        </Dialog.Description>
      </Dialog.Header>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <p class="text-sm font-medium">Apply to</p>
          <ToggleGroup.Root
            type="single"
            variant="outline"
            class="grid w-full grid-cols-3"
            bind:value={applyTarget}
            disabled={applyBusy}
          >
            <ToggleGroup.Item value="live-ledger">Live ledger</ToggleGroup.Item>
            <ToggleGroup.Item value="pending-imports"
              >Pending imports</ToggleGroup.Item
            >
            <ToggleGroup.Item value="both">Both</ToggleGroup.Item>
          </ToggleGroup.Root>
          <p class="text-xs text-muted-foreground">
            Live ledger is selected by default. Both updates two separate stores
            and is never selected automatically.
          </p>
        </div>

        <div class="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
          {#if applyPreviewLoading}
            Checking matching transactions…
          {:else}
            {@const totals = previewTotals(applyPreview)}
            <p>
              {totals.total} matching rule {totals.total === 1
                ? "entry"
                : "entries"}
              across {totals.pendingImports} pending
              {totals.pendingImports === 1 ? "import" : "imports"} and
              {totals.liveLedger} live ledger
              {totals.liveLedger === 1 ? "entry" : "entries"}.
            </p>
            {#if applyPreview.length > 1}
              <p class="mt-1 text-xs text-muted-foreground">
                A transaction matched by more than one rule is counted once per
                matching rule.
              </p>
            {/if}
          {/if}
        </div>
      </div>

      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          disabled={applyBusy}
          onclick={() => (applyOpen = false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={applyBusy || applyPreviewLoading}
          onclick={() => void applySelectedRules()}
        >
          Run on {targetLabel(applyTarget)}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>

  {#key editingRule?.id ?? "new"}
    <RuleEditorSheet
      bind:open={editorOpen}
      rule={editingRule}
      registry={registry ?? { filters: [], executors: [] }}
      {accounts}
      onSave={handleRuleSaved}
    />
  {/key}
{/if}
