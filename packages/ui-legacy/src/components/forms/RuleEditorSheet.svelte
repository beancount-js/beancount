<script lang="ts">
  import type { ComponentType } from "svelte";
  import FolderTree from "lucide-svelte/icons/folder-tree";
  import Plus from "lucide-svelte/icons/plus";
  import Pencil from "lucide-svelte/icons/pencil";
  import ScanSearch from "lucide-svelte/icons/scan-search";
  import Sparkles from "lucide-svelte/icons/sparkles";
  import Store from "lucide-svelte/icons/store";
  import Tag from "lucide-svelte/icons/tag";
  import Trash2 from "lucide-svelte/icons/trash-2";
  import X from "lucide-svelte/icons/x";
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
  import FilterCommandPicker from "./FilterCommandPicker.svelte";
  import FormAddButton from "./FormAddButton.svelte";
  import FormSectionHeader from "./FormSectionHeader.svelte";
  import TagEditor from "./TagEditor.svelte";
  import type { FilterCommandOption } from "./picker-options";
  import * as Alert from "../shadcn/alert";
  import { Button } from "../shadcn/button";
  import { Input } from "../shadcn/input";
  import * as Select from "../shadcn/select";
  import * as Sheet from "../shadcn/sheet";
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
    "cn-form-section-title cn-form-section-title--muted";
  const actionIcons: Record<RuleActionType, ComponentType> = {
    set_transaction_category: FolderTree,
    set_transaction_tags: Tag,
    set_transaction_merchant: Store,
    set_transaction_name: Pencil,
    exclude_transaction: Trash2,
    auto_categorise_with_ai: Sparkles,
    auto_detect_merchant_with_ai: ScanSearch,
  };
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

  const accountOptions = $derived(
    accounts.map((account) => ({ value: account, label: account })),
  );
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

  function actionIcon(actionType: RuleActionType) {
    return actionIcons[actionType];
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
    class="cn-forms-ruleeditorsheet-246-1"
    data-rule-editor-sheet
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      sheetTitleEl?.focus();
    }}
  >
    <Sheet.Header class="cn-forms-ruleeditorsheet-254-1">
      <Sheet.Title
        bind:ref={sheetTitleEl}
        tabindex={-1}
        class="cn-forms-ruleeditorsheet-259-1 rule-sheet-title"
      >
        {dialogTitle}
      </Sheet.Title>
      <Sheet.Description class="sr-only">
        Configure the conditions, actions, and effective date for this detection
        rule.
      </Sheet.Description>
      <Sheet.Close class="cn-forms-ruleeditorsheet-268-1" aria-label="Close">
        <X class="cn-forms-ruleeditorsheet-271-1" />
        <span class="sr-only">Close</span>
      </Sheet.Close>
    </Sheet.Header>

    <div class="cn-forms-ruleeditorsheet-276-1">
      {#if errors.length}
        <Alert.Root
          variant="destructive"
          class="cn-forms-ruleeditorsheet-278-1"
        >
          <Alert.Title>Could not save rule</Alert.Title>
          <Alert.Description class="cn-forms-ruleeditorsheet-280-1"
            >{errors.join("\n")}</Alert.Description
          >
        </Alert.Root>
      {/if}

      <div class="cn-forms-ruleeditorsheet-286-1 rule-form">
        <div class="cn-forms-ruleeditorsheet-287-1">
          <label for="rule-editor-name" class="cn-forms-ruleeditorsheet-290-1"
            >Rule name</label
          >
          <Input
            id="rule-editor-name"
            bind:value={name}
            placeholder="Optional name for this rule"
          />
        </div>

        <section class="cn-forms-ruleeditorsheet-299-1">
          <FormSectionHeader
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
            <div class="cn-forms-ruleeditorsheet-311-1">
              {#each conditions as condition, index (condition.id)}
                <RuleConditionRow
                  {condition}
                  {registry}
                  {accountOptions}
                  onChange={(next) => updateCondition(index, next)}
                  onRemove={() => removeCondition(index)}
                />
              {:else}
                <p class="cn-forms-ruleeditorsheet-321-1">
                  No conditions yet. Add one below.
                </p>
              {/each}
              <div class="cn-forms-ruleeditorsheet-325-1">
                <FormAddButton label="Add condition" onclick={addCondition} />
                <FormAddButton
                  label="Add condition group"
                  onclick={addConditionGroup}
                />
              </div>
            </div>
          {/if}
        </section>

        <section class="cn-forms-ruleeditorsheet-336-1">
          <FormSectionHeader
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
            <div class="cn-forms-ruleeditorsheet-348-1">
              {#each actions as action, index (action.id)}
                {@const meta = actionMeta(action.actionType)}
                {@const ActionIcon = actionIcon(action.actionType)}
                <div
                  class="cn-forms-ruleeditorsheet-353-1"
                  data-rule-action-row
                >
                  <div
                    class={`cn-forms-ruleeditorsheet-357-3 ${meta?.type === "function" ? "cn-forms-ruleeditorsheet-357-2" : "cn-forms-ruleeditorsheet-357-1"}`}
                  >
                    <Select.Root
                      type="single"
                      value={action.actionType}
                      onValueChange={(next) => {
                        if (next)
                          changeActionType(action, next as RuleActionType);
                      }}
                    >
                      <Select.Trigger
                        class="cn-forms-ruleeditorsheet-368-1"
                        aria-label="Action type"
                      >
                        <div class="cn-forms-ruleeditorsheet-371-1">
                          <ActionIcon
                            class="cn-forms-ruleeditorsheet-373-1"
                            aria-hidden="true"
                          />
                          <span class="cn-forms-ruleeditorsheet-376-1"
                            >{meta?.label ?? action.actionType}</span
                          >
                        </div>
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Group>
                          {#each registry.executors as executor (executor.key)}
                            {@const ExecutorIcon = actionIcon(executor.key)}
                            <Select.Item value={executor.key}>
                              <div class="cn-forms-ruleeditorsheet-386-1">
                                <ExecutorIcon
                                  class="cn-forms-ruleeditorsheet-388-1"
                                  aria-hidden="true"
                                />
                                <span class="cn-forms-ruleeditorsheet-391-1"
                                  >{executor.label}</span
                                >
                              </div>
                            </Select.Item>
                          {/each}
                        </Select.Group>
                      </Select.Content>
                    </Select.Root>
                  </div>

                  <div
                    class={`cn-forms-ruleeditorsheet-401-3 ${meta?.type === "function" ? "cn-forms-ruleeditorsheet-401-1" : "cn-forms-ruleeditorsheet-401-2"}`}
                  >
                    {#if meta?.type === "function"}
                      <p class="cn-forms-ruleeditorsheet-404-1">
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
                    class="cn-forms-ruleeditorsheet-446-1"
                    aria-label="Remove action"
                    onclick={() => removeAction(index)}
                  >
                    <Trash2 class="cn-forms-ruleeditorsheet-450-1" />
                  </Button>
                </div>
              {:else}
                <p class="cn-forms-ruleeditorsheet-454-1">
                  No actions yet. Add one below.
                </p>
              {/each}
              <FormAddButton label="Add action" onclick={addAction} />
            </div>
          {/if}
        </section>

        <section class="cn-forms-ruleeditorsheet-463-1">
          <FormSectionHeader
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
            <div class="cn-forms-ruleeditorsheet-475-1">
              <label class="cn-forms-ruleeditorsheet-476-1">
                <input
                  type="radio"
                  name="rule-editor-effective-mode"
                  value="all"
                  checked={forMode === "all"}
                  onchange={() => (forMode = "all")}
                />
                All past and future transactions
              </label>
              <label class="cn-forms-ruleeditorsheet-486-1">
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
                    class="cn-forms-ruleeditorsheet-499-1"
                  />
                {/if}
              </label>
            </div>
          {/if}
        </section>
      </div>
    </div>

    <Sheet.Footer class="cn-forms-ruleeditorsheet-510-1">
      <Sheet.Close class="cn-forms-ruleeditorsheet-513-1">Cancel</Sheet.Close>
      <Button type="button" onclick={handleSave}>
        <Plus class="cn-forms-ruleeditorsheet-518-1" aria-hidden="true" />
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
