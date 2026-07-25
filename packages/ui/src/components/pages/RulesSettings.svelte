<script lang="ts">
  import ArrowDownWideNarrow from "lucide-svelte/icons/arrow-down-wide-narrow";
  import ArrowUpDown from "lucide-svelte/icons/arrow-up-down";
  import ArrowUpNarrowWide from "lucide-svelte/icons/arrow-up-narrow-wide";
  import FileCode2 from "lucide-svelte/icons/file-code-2";
  import ListFilter from "lucide-svelte/icons/list-filter";
  import MoreHorizontal from "lucide-svelte/icons/more-horizontal";
  import Pencil from "lucide-svelte/icons/pencil";
  import Play from "lucide-svelte/icons/play";
  import Trash2 from "lucide-svelte/icons/trash-2";
  import {
    summarizeRule,
    type DetectionRule,
    type RuleApplyTarget,
    type RuleRegistryMeta,
    type RuleRun,
  } from "@beancount-js/beangulp";
  import * as Alert from "../shadcn/alert";
  import { Button } from "../shadcn/button";
  import * as Dialog from "../shadcn/dialog";
  import * as DropdownMenu from "../shadcn/dropdown-menu";
  import * as Empty from "../shadcn/empty";
  import { Switch } from "../shadcn/switch";
  import * as ToggleGroup from "../shadcn/toggle-group";
  import { cn } from "../../lib/utils";
  import RuleEditorSheet from "../forms/RuleEditorSheet.svelte";
  import PagePagination from "../navigation/PagePagination.svelte";
  import RulesPageSkeleton from "../feedback/RulesPageSkeleton.svelte";

  type SortKey = "name" | "active";
  type SortOrder = "none" | "asc" | "desc";

  type RuleApplyTargetCounts = {
    pendingImports: number;
    liveLedger: number;
  };

  type RuleApplyPreviewSummary = {
    unique: RuleApplyTargetCounts;
    overlaps: RuleApplyTargetCounts;
    conflicts: RuleApplyTargetCounts;
  };

  type RuleApplyPreview = {
    summary: RuleApplyPreviewSummary;
  };

  type Props = {
    isWeb?: boolean;
    hasProject?: boolean;
    loading?: boolean;
    status?: string;
    rules?: readonly DetectionRule[];
    runs?: readonly RuleRun[];
    runsOffset?: number;
    runsTotal?: number;
    registry?: RuleRegistryMeta;
    accounts?: readonly string[];
    applyBusy?: boolean;
    applyPreviewLoading?: boolean;
    applyRuleIds?: readonly string[] | undefined;
    applyLabel?: string;
    applyTarget?: RuleApplyTarget;
    applyPreview?: RuleApplyPreview | null;
    editingRule?: DetectionRule | null;
    onToggleActive?: (rule: DetectionRule, active: boolean) => void;
    onOpenEdit?: (rule: DetectionRule) => void;
    onOpenApply?: (rule?: DetectionRule) => void;
    onDeleteRule?: (rule: DetectionRule) => void;
    onRunsPageChange?: (nextOffset: number) => void;
    onApplyTargetChange?: (target: RuleApplyTarget) => void;
    onApply?: () => void;
    onRuleSaved?: (next: DetectionRule) => void;
    onEditorClosed?: () => void;
    applyOpen?: boolean;
    editorOpen?: boolean;
  };

  const RUNS_LIMIT = 10;
  const SORT_CYCLE: Record<SortOrder, SortOrder> = {
    none: "asc",
    asc: "desc",
    desc: "none",
  };

  let {
    isWeb = false,
    hasProject = false,
    loading = false,
    status = "",
    rules = [],
    runs = [],
    runsOffset = 0,
    runsTotal = 0,
    registry = { filters: [], executors: [] },
    accounts = [],
    applyBusy = false,
    applyOpen = $bindable(false),
    applyPreviewLoading = false,
    applyRuleIds = undefined,
    applyLabel = "",
    applyTarget = "live-ledger",
    applyPreview = null,
    editingRule = null,
    editorOpen = $bindable(false),
    onToggleActive = () => {},
    onOpenEdit = () => {},
    onOpenApply = () => {},
    onDeleteRule = () => {},
    onRunsPageChange = () => {},
    onApplyTargetChange = () => {},
    onApply = () => {},
    onRuleSaved = () => {},
    onEditorClosed = () => {},
  }: Props = $props();

  let sortOrders = $state<Record<SortKey, SortOrder>>({
    name: "asc",
    active: "none",
  });
  /** Order sorts were added; earlier entries are primary. */
  let sortPriority = $state<SortKey[]>(["name"]);

  const runsPage = $derived(Math.floor(runsOffset / RUNS_LIMIT) + 1);
  const runsPageCount = $derived(
    Math.max(1, Math.ceil(runsTotal / RUNS_LIMIT)),
  );
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

  function statusPillClass(statusValue: RuleRun["status"]) {
    if (statusValue === "success") {
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
    }
    if (statusValue === "failed") {
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
    }
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  }

  function targetLabel(target: RuleApplyTarget | undefined) {
    if (target === "live-ledger") return "live ledger";
    if (target === "pending-imports") return "pending imports";
    if (target === "both") return "pending imports and the live ledger";
    return "legacy";
  }

  function totalTargetCount(counts: RuleApplyTargetCounts) {
    return counts.pendingImports + counts.liveLedger;
  }

  function handleRunsPageChange(nextPage: number) {
    onRunsPageChange((nextPage - 1) * RUNS_LIMIT);
  }

  function handleApplyTargetChange(next: string | undefined) {
    if (
      next === "live-ledger" ||
      next === "pending-imports" ||
      next === "both"
    ) {
      onApplyTargetChange(next);
    }
  }
</script>

<section class="cn-pages-rulessettings-213-1" data-rules-settings>
  <div class="cn-pages-rulessettings-214-1">
    {#if isWeb}
      <Alert.Root>
        <FileCode2 />
        <Alert.Title>Local server required</Alert.Title>
        <Alert.Description
          >Detection rules are available only through the local server.</Alert.Description
        >
      </Alert.Root>
    {:else if !hasProject}
      <Empty.Root class="cn-pages-rulessettings-224-1">
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
        <Empty.Root class="cn-pages-rulessettings-237-1">
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
        <div class="cn-pages-rulessettings-249-1">
          <div class="cn-pages-rulessettings-251-1">
            <button
              type="button"
              class="cn-pages-rulessettings-254-1"
              aria-label={`Sort by rule name, currently ${sortOrders.name}`}
              onclick={() => cycleSort("name")}
            >
              Rule
              {#if sortOrders.name === "asc"}
                <ArrowUpNarrowWide
                  class="cn-pages-rulessettings-260-1"
                  aria-hidden="true"
                />
              {:else if sortOrders.name === "desc"}
                <ArrowDownWideNarrow
                  class="cn-pages-rulessettings-262-1"
                  aria-hidden="true"
                />
              {:else}
                <ArrowUpDown
                  class="cn-pages-rulessettings-264-1"
                  aria-hidden="true"
                />
              {/if}
            </button>
          </div>
          <div class="cn-pages-rulessettings-268-1">
            <button
              type="button"
              class="cn-pages-rulessettings-271-1"
              aria-label={`Sort by active status, currently ${sortOrders.active}`}
              onclick={() => cycleSort("active")}
            >
              Active
              {#if sortOrders.active === "asc"}
                <ArrowUpNarrowWide
                  class="cn-pages-rulessettings-277-1"
                  aria-hidden="true"
                />
              {:else if sortOrders.active === "desc"}
                <ArrowDownWideNarrow
                  class="cn-pages-rulessettings-279-1"
                  aria-hidden="true"
                />
              {:else}
                <ArrowUpDown
                  class="cn-pages-rulessettings-281-1"
                  aria-hidden="true"
                />
              {/if}
            </button>
          </div>
          <div aria-hidden="true"></div>
        </div>
        <div class="cn-pages-rulessettings-287-1">
          {#each sortedRules as rule, index (rule.id)}
            {@const summary = summarizeRule(rule)}
            <div
              class:cn-pages-rulessettings-291-1={index ===
                sortedRules.length - 1}
              class="cn-pages-rulessettings-292-1"
            >
              <button
                type="button"
                class="cn-pages-rulessettings-296-1"
                aria-label={`Edit rule ${ruleName(rule)}`}
                onclick={() => onOpenEdit(rule)}
              >
                <span class="cn-pages-rulessettings-300-1"
                  >{ruleName(rule)}</span
                >
                <span class="cn-pages-rulessettings-303-1">
                  <span class="cn-pages-rulessettings-305-1" title={summary.if}
                    ><span class="cn-pages-rulessettings-307-1">IF</span>
                    {summary.if}</span
                  >
                  <span
                    class="cn-pages-rulessettings-311-1"
                    title={summary.then}
                    ><span class="cn-pages-rulessettings-313-1">THEN</span>
                    {summary.then}</span
                  >
                  <span class="cn-pages-rulessettings-317-1" title={summary.for}
                    ><span class="cn-pages-rulessettings-319-1">FOR</span>
                    {summary.for}</span
                  >
                </span>
              </button>

              <Switch
                checked={rule.active}
                aria-label={rule.active ? "Deactivate rule" : "Activate rule"}
                onclick={(event) => {
                  event.stopPropagation();
                }}
                onCheckedChange={(checked) => onToggleActive(rule, checked)}
              />

              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  {#snippet child({ props })}
                    <Button
                      {...props}
                      type="button"
                      variant="ghost"
                      size="icon"
                      class="cn-pages-rulessettings-342-1"
                      aria-label="Rule actions"
                      onclick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <MoreHorizontal class="cn-pages-rulessettings-348-1" />
                    </Button>
                  {/snippet}
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end">
                  <DropdownMenu.Item onSelect={() => onOpenEdit(rule)}>
                    <Pencil
                      class="cn-pages-rulessettings-354-1"
                      aria-hidden="true"
                    />
                    Edit
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    disabled={applyBusy}
                    onSelect={() => onOpenApply(rule)}
                  >
                    <Play
                      class="cn-pages-rulessettings-361-1"
                      aria-hidden="true"
                    />
                    Run…
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    class="cn-pages-rulessettings-366-1"
                    onSelect={() => onDeleteRule(rule)}
                  >
                    <Trash2
                      class="cn-pages-rulessettings-369-1"
                      aria-hidden="true"
                    />
                    Delete
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Root>
            </div>
          {/each}
        </div>
      {/if}

      <div class="cn-pages-rulessettings-379-1">
        <h2 class="cn-pages-rulessettings-381-1">Recent runs</h2>
        {#if !runs.length}
          <p class="cn-pages-rulessettings-386-1">No rule runs yet.</p>
        {:else}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div
            class="cn-pages-rulessettings-390-1"
            role="region"
            tabindex="0"
            aria-label="Recent rule runs table"
          >
            <table class="cn-pages-rulessettings-395-1">
              <thead>
                <tr class="cn-pages-rulessettings-398-1">
                  <th class="cn-pages-rulessettings-400-1">Date/Time</th>
                  <th class="cn-pages-rulessettings-401-1">Type</th>
                  <th class="cn-pages-rulessettings-402-1">Target</th>
                  <th class="cn-pages-rulessettings-403-1">Status</th>
                  <th class="cn-pages-rulessettings-404-1">Rule</th>
                  <th class="cn-pages-rulessettings-405-1">Queued</th>
                  <th class="cn-pages-rulessettings-406-1">Processed</th>
                  <th class="cn-pages-rulessettings-407-1">Modified</th>
                  <th class="cn-pages-rulessettings-408-1">Blocked</th>
                </tr>
              </thead>
              <tbody>
                {#each runs as run (run.id)}
                  <tr class="cn-pages-rulessettings-413-1">
                    <td class="cn-pages-rulessettings-415-1"
                      >{formatDateTime(run.executedAt)}</td
                    >
                    <td class="cn-pages-rulessettings-418-1"
                      >{run.executionType}</td
                    >
                    <td class="cn-pages-rulessettings-421-1"
                      >{targetLabel(run.target)}</td
                    >
                    <td class="cn-pages-rulessettings-424-1">
                      <span
                        class={cn(
                          "cn-pages-rulessettings-427-1",
                          statusPillClass(run.status),
                        )}
                        title={run.errorMessage ?? undefined}>{run.status}</span
                      >
                    </td>
                    <td class="cn-pages-rulessettings-434-1">{run.ruleName}</td>
                    <td class="cn-pages-rulessettings-437-1"
                      >{run.transactionsQueued}</td
                    >
                    <td class="cn-pages-rulessettings-440-1"
                      >{run.transactionsProcessed}</td
                    >
                    <td class="cn-pages-rulessettings-443-1"
                      >{run.transactionsModified}</td
                    >
                    <td class="cn-pages-rulessettings-446-1"
                      >{run.transactionsBlocked}</td
                    >
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          {#if runsPageCount > 1}
            <div class="cn-pages-rulessettings-457-1" data-rule-run-pagination>
              <span class="cn-pages-rulessettings-460-1"
                >Page {runsPage} of {runsPageCount}</span
              >
              <PagePagination
                page={runsPage}
                pageCount={runsPageCount}
                ariaLabel="Rule run pages"
                disabled={loading}
                onPageChange={handleRunsPageChange}
              />
            </div>
          {/if}
        {/if}
      </div>
    {/if}

    <p class="cn-pages-rulessettings-476-1">{status}</p>
  </div>
</section>

{#if hasProject}
  <Dialog.Root bind:open={applyOpen}>
    <Dialog.Content class="cn-pages-rulessettings-482-1">
      <Dialog.Header>
        <Dialog.Title>Run rules</Dialog.Title>
        <Dialog.Description>
          Choose where to run {applyLabel}. Running rules from this page is a
          bulk-fix operation; it does not change ingestion automation.
        </Dialog.Description>
      </Dialog.Header>

      <div class="cn-pages-rulessettings-491-1">
        <div class="cn-pages-rulessettings-492-1">
          <p class="cn-pages-rulessettings-493-1">Apply to</p>
          <ToggleGroup.Root
            type="single"
            aria-label="Rule run target"
            class="cn-pages-rulessettings-497-1"
            bind:value={applyTarget}
            disabled={applyBusy}
            onValueChange={handleApplyTargetChange}
          >
            <ToggleGroup.Item
              value="live-ledger"
              class="cn-pages-rulessettings-504-1">Live ledger</ToggleGroup.Item
            >
            <ToggleGroup.Item
              value="pending-imports"
              class="cn-pages-rulessettings-509-1"
              >Pending imports</ToggleGroup.Item
            >
            <ToggleGroup.Item value="both" class="cn-pages-rulessettings-514-1"
              >Both</ToggleGroup.Item
            >
          </ToggleGroup.Root>
          <p class="cn-pages-rulessettings-518-1">
            Live ledger is selected by default. Both updates two separate stores
            and is never selected automatically.
          </p>
        </div>

        <div class="cn-pages-rulessettings-524-1">
          {#if applyPreviewLoading}
            Checking matching transactions…
          {:else if applyPreview}
            {@const summary = applyPreview.summary}
            {@const uniqueTotal = totalTargetCount(summary.unique)}
            {@const overlapTotal = totalTargetCount(summary.overlaps)}
            {@const conflictTotal = totalTargetCount(summary.conflicts)}
            <p>
              {uniqueTotal} unique matching {uniqueTotal === 1
                ? "entry"
                : "entries"}
              across {summary.unique.pendingImports} pending
              {summary.unique.pendingImports === 1 ? "import" : "imports"}
              and {summary.unique.liveLedger} live ledger
              {summary.unique.liveLedger === 1 ? "entry" : "entries"}.
            </p>
            {#if overlapTotal > 0}
              <p class="cn-pages-rulessettings-542-1">
                {overlapTotal} additional {overlapTotal === 1
                  ? "rule match"
                  : "rule matches"} overlap. Rules run in their stored order.
              </p>
            {/if}
            {#if conflictTotal > 0}
              <p class="cn-pages-rulessettings-549-1">
                {conflictTotal} conflicting field {conflictTotal === 1
                  ? "write was"
                  : "writes were"} found; the later stored rule wins.
              </p>
            {/if}
          {:else}
            No matching transactions found.
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
          onclick={onApply}
        >
          Run on {targetLabel(applyTarget)}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>

  {#if editingRule !== null || editorOpen}
    {#key editingRule?.id ?? "new"}
      <RuleEditorSheet
        bind:open={editorOpen}
        rule={editingRule}
        {registry}
        accounts={Array.from(accounts)}
        onSave={onRuleSaved}
        onClosed={onEditorClosed}
      />
    {/key}
  {/if}
{/if}
