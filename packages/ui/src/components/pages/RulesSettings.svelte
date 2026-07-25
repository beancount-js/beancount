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
    {:else if !hasProject}
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
              >Add a rule to automatically categorize, tag, or exclude
              matching transactions.</Empty.Description
            >
          </Empty.Header>
        </Empty.Root>
      {:else}
        <div
          class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl bg-muted px-4 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          <div class="justify-self-start">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Sort by rule name, currently ${sortOrders.name}`}
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
          <div class="justify-self-end">
            <button
              type="button"
              class="inline-flex items-center justify-end gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Sort by active status, currently ${sortOrders.active}`}
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
          <div aria-hidden="true"></div>
        </div>
        <div class="overflow-hidden rounded-xl border bg-card shadow-sm">
          {#each sortedRules as rule, index (rule.id)}
            {@const summary = summarizeRule(rule)}
            <div
              class:rounded-b-xl={index === sortedRules.length - 1}
              class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-accent/60"
            >
              <button
                type="button"
                class="min-w-0 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Edit rule ${ruleName(rule)}`}
                onclick={() => onOpenEdit(rule)}
              >
                <span class="block truncate text-sm font-semibold"
                  >{ruleName(rule)}</span
                >
                <span class="mt-1.5 flex flex-wrap items-center gap-1.5">
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
                  <DropdownMenu.Item onSelect={() => onOpenEdit(rule)}>
                    <Pencil class="size-3.5" aria-hidden="true" />
                    Edit
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    disabled={applyBusy}
                    onSelect={() => onOpenApply(rule)}
                  >
                    <Play class="size-3.5" aria-hidden="true" />
                    Run…
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item
                    class="text-destructive focus:text-destructive"
                    onSelect={() => onDeleteRule(rule)}
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
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div
            class="overflow-x-auto rounded-xl border bg-card shadow-sm"
            role="region"
            tabindex="0"
            aria-label="Recent rule runs table"
          >
            <table class="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr
                  class="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  <th class="px-4 py-2.5 font-semibold">Date/Time</th>
                  <th class="px-4 py-2.5 font-semibold">Type</th>
                  <th class="px-4 py-2.5 font-semibold">Target</th>
                  <th class="px-4 py-2.5 font-semibold">Status</th>
                  <th class="px-4 py-2.5 font-semibold">Rule</th>
                  <th class="px-4 py-2.5 text-right font-semibold">Queued</th>
                  <th class="px-4 py-2.5 text-right font-semibold">Processed</th>
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
                    <td class="px-4 py-2.5 capitalize text-muted-foreground"
                      >{targetLabel(run.target)}</td
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
                onPageChange={handleRunsPageChange}
              />
            </div>
          {/if}
        {/if}
      </div>
    {/if}

    <p class="text-sm text-muted-foreground">{status}</p>
  </div>
</section>

{#if hasProject}
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
            aria-label="Rule run target"
            class="grid w-full grid-cols-3 !gap-0 rounded-lg bg-muted p-1"
            bind:value={applyTarget}
            disabled={applyBusy}
            onValueChange={handleApplyTargetChange}
          >
            <ToggleGroup.Item
              value="live-ledger"
              class="!h-8 !min-w-0 text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
              >Live ledger</ToggleGroup.Item
            >
            <ToggleGroup.Item
              value="pending-imports"
              class="!h-8 !min-w-0 text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
              >Pending imports</ToggleGroup.Item
            >
            <ToggleGroup.Item
              value="both"
              class="!h-8 !min-w-0 text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
              >Both</ToggleGroup.Item
            >
          </ToggleGroup.Root>
          <p class="text-xs text-muted-foreground">
            Live ledger is selected by default. Both updates two separate stores
            and is never selected automatically.
          </p>
        </div>

        <div class="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
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
              <p class="mt-1 text-xs text-muted-foreground">
                {overlapTotal} additional {overlapTotal === 1
                  ? "rule match"
                  : "rule matches"} overlap. Rules run in their stored order.
              </p>
            {/if}
            {#if conflictTotal > 0}
              <p class="mt-1 text-xs text-amber-700 dark:text-amber-400">
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
