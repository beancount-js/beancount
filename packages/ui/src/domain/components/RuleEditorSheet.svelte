<script lang="ts">
  import FilterCommandPicker from "../../components/forms/FilterCommandPicker.svelte";
  import { accountPickerOption } from "../../components/forms/account-avatar";

  import { Plus } from "@lucide/svelte";
  import { Trash2 } from "@lucide/svelte";
  import { X } from "@lucide/svelte";
  import { onMount } from "svelte";
  import {
    newRuleId,
    validateDetectionRule,
    type DetectionRule,
    type RuleAction,
    type RuleActionType,
    type RuleCondition,
    type RuleRegistryMeta,
  } from "@beancount-js/beangulp";
  import {
    FormAddButton,
    FormSectionHeader,
    type FilterCommandOption,
  } from "@lapismd/design-core/forms";
  import TagEditor from "../../components/forms/TagEditor.svelte";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import * as Sheet from "@lapismd/design-core/shadcn/sheet";
  import RuleConditionRow from "./rules/RuleConditionRow.svelte";

  type Props = {
    open?: boolean;
    rule: DetectionRule | null;
    registry: RuleRegistryMeta;
    accounts: string[];
    onSave: (rule: DetectionRule) => void;
    onClosed?: () => void;
  };

  let {
    open = $bindable(false),
    rule,
    registry,
    accounts,
    onSave,
    onClosed,
  }: Props = $props();

  const sectionTitleClass =
    "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
  const isCreate = $derived(rule === null);

  let name = $state("");
  let conditions = $state<RuleCondition[]>([]);
  let actions = $state<RuleAction[]>([]);
  let forMode = $state<"all" | "from">("all");
  let effectiveDate = $state("");
  let errors = $state<string[]>([]);
  let sheetTitleEl = $state<HTMLElement | null>(null);
  let openSections = $state<Record<string, boolean>>({
    if: true,
    then: true,
    for: true,
  });

  const accountOptions = $derived(accounts.map(accountPickerOption));
  const dialogTitle = $derived(
    isCreate
      ? "Create transaction rule"
      : name.trim()
        ? `Edit transaction rule '${name.trim()}'`
        : "Edit transaction rule",
  );

  function makeLeafCondition(): RuleCondition {
    const first = registry.filters[0];
    return {
      id: newRuleId(),
      conditionType: first?.key ?? "transaction_name",
      operator: first?.operators[0]?.value ?? "=",
      value: "",
    };
  }

  function makeAction(): RuleAction {
    const first = registry.executors[0];
    return {
      id: newRuleId(),
      actionType: first?.key ?? "set_transaction_category",
      value: first?.type === "function" ? null : "",
    };
  }

  onMount(() => {
    name = rule?.name ?? "";
    conditions = rule?.conditions.length
      ? rule.conditions.map((condition) => ({ ...condition }))
      : [makeLeafCondition()];
    actions = rule?.actions.length
      ? rule.actions.map((action) => ({ ...action }))
      : [makeAction()];
    forMode = rule?.effectiveDate ? "from" : "all";
    effectiveDate = rule?.effectiveDate ?? "";
  });

  function isSectionOpen(id: string) {
    return openSections[id] !== false;
  }

  function toggleSection(id: string) {
    openSections = { ...openSections, [id]: !isSectionOpen(id) };
  }

  function addCondition() {
    conditions = [...conditions, makeLeafCondition()];
  }

  function addConditionGroup() {
    conditions = [
      ...conditions,
      {
        id: newRuleId(),
        conditionType: "compound",
        operator: "and",
        value: null,
        subConditions: [makeLeafCondition()],
      },
    ];
  }

  function updateCondition(index: number, next: RuleCondition) {
    conditions = conditions.map((condition, itemIndex) =>
      itemIndex === index ? next : condition,
    );
  }

  function removeCondition(index: number) {
    conditions = conditions.filter((_, itemIndex) => itemIndex !== index);
  }

  function addAction() {
    actions = [...actions, makeAction()];
  }

  function changeActionType(action: RuleAction, nextType: RuleActionType) {
    const meta = registry.executors.find(
      (executor) => executor.key === nextType,
    );
    updateActionById(action.id, {
      actionType: nextType,
      value: meta?.type === "function" ? null : "",
    });
  }

  function updateActionById(id: string, patch: Partial<RuleAction>) {
    actions = actions.map((action) =>
      action.id === id ? { ...action, ...patch } : action,
    );
  }

  function removeAction(index: number) {
    actions = actions.filter((_, itemIndex) => itemIndex !== index);
  }

  function actionMeta(actionType: RuleActionType) {
    return registry.executors.find((executor) => executor.key === actionType);
  }

  function actionValueOptions(
    actionType: RuleActionType,
  ): FilterCommandOption[] {
    const meta = actionMeta(actionType);
    if (meta?.options?.length) return [...meta.options];
    return accountOptions;
  }

  function tagsFromValue(value: string | null): string[] {
    if (!value?.trim()) return [];
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (item): item is string => typeof item === "string",
          );
        }
      } catch {
        // fall through to comma-separated parsing
      }
    }
    return trimmed
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function handleSave() {
    const next: DetectionRule = {
      id: rule?.id ?? newRuleId(),
      name: name.trim() ? name.trim() : null,
      resourceType: "transaction",
      active: rule?.active ?? true,
      effectiveDate: forMode === "from" ? effectiveDate || null : null,
      conditions,
      actions,
    };
    const validationErrors = validateDetectionRule(next);
    if (validationErrors.length > 0) {
      errors = validationErrors;
      return;
    }
    errors = [];
    onSave(next);
    open = false;
  }

  let wasOpen = $state(false);
  $effect(() => {
    if (wasOpen && !open) onClosed?.();
    wasOpen = open;
  });
</script>

<Sheet.Root bind:open>
  <Sheet.Content
    side="right"
    showCloseButton={false}
    data-beancount-form-sheet
    data-rule-editor-sheet
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      sheetTitleEl?.focus();
    }}
  >
    <Sheet.Header
      class="flex h-11 shrink-0 flex-row items-center gap-2 space-y-0 border-b border-border px-3 text-left sm:text-left"
    >
      <Sheet.Title
        bind:ref={sheetTitleEl}
        tabindex={-1}
        class="rule-sheet-title min-w-0 flex-1 truncate leading-none outline-none"
      >
        {dialogTitle}
      </Sheet.Title>
      <Sheet.Description class="sr-only">
        Configure the conditions, actions, and effective date for this detection
        rule.
      </Sheet.Description>
      <Sheet.Close
        class="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Close"
      >
        <X class="size-4" />
        <span class="sr-only">Close</span>
      </Sheet.Close>
    </Sheet.Header>

    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      {#if errors.length}
        <Alert.Root variant="destructive" class="mb-5">
          <Alert.Title>Could not save rule</Alert.Title>
          <Alert.Description class="whitespace-pre-wrap"
            >{errors.join("\n")}</Alert.Description
          >
        </Alert.Root>
      {/if}

      <div class="rule-form flex min-w-0 flex-col gap-6">
        <div class="flex flex-col gap-1.5">
          <label
            for="rule-editor-name"
            class="text-xs font-medium text-muted-foreground">Rule name</label
          >
          <Input
            id="rule-editor-name"
            bind:value={name}
            placeholder="Optional name for this rule"
          />
        </div>

        <section class="flex flex-col gap-3 pl-6">
          <FormSectionHeader
            index={0}
            total={1}
            title="If"
            titleClass={sectionTitleClass}
            editable={false}
            movable={false}
            removable={false}
            titleToggleable={true}
            open={isSectionOpen("if")}
            onToggle={() => toggleSection("if")}
          />
          {#if isSectionOpen("if")}
            <div class="flex min-w-0 flex-col gap-2">
              {#each conditions as condition, index (condition.id)}
                <RuleConditionRow
                  {condition}
                  {registry}
                  {accountOptions}
                  onChange={(next) => updateCondition(index, next)}
                  onRemove={() => removeCondition(index)}
                />
              {:else}
                <p class="text-sm text-muted-foreground">
                  No conditions yet. Add one below.
                </p>
              {/each}
              <div class="flex flex-wrap gap-4">
                <FormAddButton label="Add condition" onclick={addCondition} />
                <FormAddButton
                  label="Add condition group"
                  onclick={addConditionGroup}
                />
              </div>
            </div>
          {/if}
        </section>

        <section class="flex flex-col gap-3 pl-6">
          <FormSectionHeader
            index={0}
            total={1}
            title="Then"
            titleClass={sectionTitleClass}
            editable={false}
            movable={false}
            removable={false}
            titleToggleable={true}
            open={isSectionOpen("then")}
            onToggle={() => toggleSection("then")}
          />
          {#if isSectionOpen("then")}
            <div class="flex min-w-0 flex-col gap-2">
              {#each actions as action, index (action.id)}
                {@const meta = actionMeta(action.actionType)}
                <div
                  class="flex min-w-0 flex-nowrap items-center gap-2 rounded-md border border-border bg-background p-2"
                  data-rule-action-row
                >
                  <div class="min-w-0 flex-[1_1_13rem]">
                    <Select.Root
                      type="single"
                      value={action.actionType}
                      onValueChange={(next) => {
                        if (next)
                          changeActionType(action, next as RuleActionType);
                      }}
                    >
                      <Select.Trigger
                        class="h-9 text-sm"
                        aria-label="Action type"
                      >
                        {meta?.label ?? action.actionType}
                      </Select.Trigger>
                      <Select.Content aria-label="Action type options">
                        {#each registry.executors as executor (executor.key)}
                          <Select.Item value={executor.key}
                            >{executor.label}</Select.Item
                          >
                        {/each}
                      </Select.Content>
                    </Select.Root>
                  </div>

                  <div class="min-w-0 flex-[2_1_14rem]">
                    {#if meta?.type === "function"}
                      <p class="px-1 text-sm text-muted-foreground">
                        No value required
                      </p>
                    {:else if meta?.type === "select"}
                      <FilterCommandPicker
                        fullWidth
                        label={meta.label}
                        ariaLabel={`Select ${meta.label.toLowerCase()}`}
                        placeholder={`Filter ${meta.label.toLowerCase()}...`}
                        value={action.value ?? ""}
                        options={actionValueOptions(action.actionType)}
                        onChange={(next) =>
                          updateActionById(action.id, { value: next })}
                      />
                    {:else if meta?.type === "tags"}
                      <TagEditor
                        showLabel={false}
                        embedded
                        placeholder="Add tag..."
                        value={tagsFromValue(action.value)}
                        onChange={(tags) =>
                          updateActionById(action.id, {
                            value: tags.join(", "),
                          })}
                      />
                    {:else}
                      <Input
                        value={action.value ?? ""}
                        placeholder="Value"
                        oninput={(event) =>
                          updateActionById(action.id, {
                            value: (event.currentTarget as HTMLInputElement)
                              .value,
                          })}
                      />
                    {/if}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="ml-auto size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Remove action"
                    onclick={() => removeAction(index)}
                  >
                    <Trash2 class="size-4" />
                  </Button>
                </div>
              {:else}
                <p class="text-sm text-muted-foreground">
                  No actions yet. Add one below.
                </p>
              {/each}
              <FormAddButton label="Add action" onclick={addAction} />
            </div>
          {/if}
        </section>

        <section class="flex flex-col gap-3 pl-6">
          <FormSectionHeader
            index={0}
            total={1}
            title="For"
            titleClass={sectionTitleClass}
            editable={false}
            movable={false}
            removable={false}
            titleToggleable={true}
            open={isSectionOpen("for")}
            onToggle={() => toggleSection("for")}
          />
          {#if isSectionOpen("for")}
            <div class="flex flex-col gap-2.5 text-sm">
              <label class="flex items-center gap-2">
                <input
                  type="radio"
                  name="rule-editor-effective-mode"
                  value="all"
                  checked={forMode === "all"}
                  onchange={() => (forMode = "all")}
                />
                All past and future transactions
              </label>
              <label class="flex items-center gap-2">
                <input
                  type="radio"
                  name="rule-editor-effective-mode"
                  value="from"
                  checked={forMode === "from"}
                  onchange={() => (forMode = "from")}
                />
                Starting from
                {#if forMode === "from"}
                  <Input
                    type="date"
                    bind:value={effectiveDate}
                    class="h-8 w-40"
                  />
                {/if}
              </label>
            </div>
          {/if}
        </section>
      </div>
    </div>

    <Sheet.Footer
      class="flex shrink-0 flex-row items-center justify-end gap-2 border-t border-border px-6 py-3"
    >
      <Sheet.Close
        class="inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Cancel
      </Sheet.Close>
      <Button type="button" onclick={handleSave}>
        <Plus class="size-4" aria-hidden="true" />
        {isCreate ? "Create Rule" : "Update Rule"}
      </Button>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet.Root>

<style>
  :global(.rule-sheet-title),
  .rule-form :global(.beancount-form-section-title-toggle),
  .rule-form :global(.beancount-form-section-title-row h3) {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
</style>
