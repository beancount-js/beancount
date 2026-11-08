<script lang="ts">
  import FilterCommandPicker from "../../../components/forms/FilterCommandPicker.svelte";

  import { Trash2 } from "@lucide/svelte";
  import {
    newRuleId,
    type RuleCondition,
    type RuleConditionType,
    type RuleRegistryMeta,
  } from "@beancount-js/beangulp";
  import {
    FormAddButton,
    type FilterCommandOption,
  } from "@lapismd/design-core/forms";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Select from "@lapismd/design-core/shadcn/select";

  type Props = {
    condition: RuleCondition;
    registry: RuleRegistryMeta;
    accountOptions: FilterCommandOption[];
    disabled?: boolean;
    onChange: (next: RuleCondition) => void;
    onRemove: () => void;
  };

  let {
    condition,
    registry,
    accountOptions,
    disabled = false,
    onChange,
    onRemove,
  }: Props = $props();

  const groupOperatorOptions = [
    { value: "and", label: "All conditions match (AND)" },
    { value: "or", label: "Any condition matches (OR)" },
  ];

  const valuelessOperators = new Set(["is_null", "is_not_null"]);
  const freeTextOperators = new Set([
    "like",
    "not_like",
    "matches",
    "not_matches",
  ]);

  function filterMeta(key: RuleConditionType) {
    return registry.filters.find((filter) => filter.key === key);
  }

  function fieldOptions() {
    return registry.filters.map((filter) => ({
      value: filter.key,
      label: filter.label,
    }));
  }

  function operatorLabel(condition: RuleCondition) {
    return (
      filterMeta(condition.conditionType)?.operators.find(
        (operator) => operator.value === condition.operator,
      )?.label ?? condition.operator
    );
  }

  function valueOptions(key: RuleConditionType): FilterCommandOption[] {
    if (key === "transaction_account") return accountOptions;
    const meta = filterMeta(key);
    return (meta?.options ?? []).map((option) => ({
      value: option.value,
      label: option.label,
    }));
  }

  function makeLeaf(): RuleCondition {
    const first = registry.filters[0];
    return {
      id: newRuleId(),
      conditionType: first?.key ?? "transaction_name",
      operator: first?.operators[0]?.value ?? "=",
      value: "",
    };
  }

  function updateLeaf(
    current: RuleCondition,
    patch: Partial<RuleCondition>,
    emit: (next: RuleCondition) => void,
  ) {
    emit({ ...current, ...patch });
  }

  function changeField(
    current: RuleCondition,
    nextKey: RuleConditionType,
    emit: (next: RuleCondition) => void,
  ) {
    const meta = filterMeta(nextKey);
    emit({
      ...current,
      conditionType: nextKey,
      operator: meta?.operators[0]?.value ?? "=",
      value: "",
    });
  }

  function changeOperator(
    current: RuleCondition,
    nextOperator: string,
    emit: (next: RuleCondition) => void,
  ) {
    emit({
      ...current,
      operator: nextOperator,
      value: valuelessOperators.has(nextOperator)
        ? null
        : (current.value ?? ""),
    });
  }

  function usesFreeTextValue(condition: RuleCondition) {
    const meta = filterMeta(condition.conditionType);
    return meta?.type === "text" || freeTextOperators.has(condition.operator);
  }

  function valuePlaceholder(condition: RuleCondition) {
    if (
      condition.operator === "matches" ||
      condition.operator === "not_matches"
    ) {
      return "Regular expression";
    }
    if (condition.operator === "like" || condition.operator === "not_like") {
      return "Text to find";
    }
    return "Value";
  }

  function addSubCondition() {
    onChange({
      ...condition,
      subConditions: [...(condition.subConditions ?? []), makeLeaf()],
    });
  }

  function updateSubCondition(index: number, next: RuleCondition) {
    const subConditions = [...(condition.subConditions ?? [])];
    subConditions[index] = next;
    onChange({ ...condition, subConditions });
  }

  function removeSubCondition(index: number) {
    const subConditions = (condition.subConditions ?? []).filter(
      (_, itemIndex) => itemIndex !== index,
    );
    onChange({ ...condition, subConditions });
  }
</script>

{#snippet LeafRow({
  leaf,
  emit,
  remove,
}: {
  leaf: RuleCondition;
  emit: (next: RuleCondition) => void;
  remove: () => void;
})}
  {@const meta = filterMeta(leaf.conditionType)}
  {@const operators = meta?.operators ?? []}
  <div
    class="flex min-w-0 flex-nowrap items-center gap-2 rounded-md border border-border bg-background p-2"
    data-rule-condition-row
  >
    <div class="min-w-0 flex-[1_1_11rem]">
      <Select.Root
        type="single"
        value={leaf.conditionType}
        {disabled}
        onValueChange={(next) => {
          if (next) changeField(leaf, next as RuleConditionType, emit);
        }}
      >
        <Select.Trigger
          class="h-9 w-full min-w-0 overflow-hidden text-sm"
          style="width: 100%"
          aria-label={`Condition field: ${meta?.label ?? leaf.conditionType}`}
          title={meta?.label ?? leaf.conditionType}
        >
          <span class="min-w-0 truncate">
            {meta?.label ?? leaf.conditionType}
          </span>
        </Select.Trigger>
        <Select.Content aria-label="Condition field options">
          {#each fieldOptions() as option (option.value)}
            <Select.Item value={option.value}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <div class="min-w-0 flex-[1_1_9rem]">
      <Select.Root
        type="single"
        value={leaf.operator}
        {disabled}
        onValueChange={(next) => {
          if (next) changeOperator(leaf, next, emit);
        }}
      >
        <Select.Trigger
          class="h-9 w-full min-w-0 overflow-hidden text-sm"
          style="width: 100%"
          aria-label={`Condition operator: ${operatorLabel(leaf)}`}
          title={operatorLabel(leaf)}
        >
          <span class="min-w-0 truncate">{operatorLabel(leaf)}</span>
        </Select.Trigger>
        <Select.Content aria-label="Condition operator options">
          {#each operators as operator (operator.value)}
            <Select.Item value={operator.value}>{operator.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    {#if !valuelessOperators.has(leaf.operator)}
      <div class="min-w-0 flex-[2_1_12rem]">
        {#if meta?.type === "number"}
          <Input
            type="number"
            value={leaf.value ?? ""}
            {disabled}
            placeholder="Amount"
            oninput={(event) =>
              updateLeaf(
                leaf,
                { value: (event.currentTarget as HTMLInputElement).value },
                emit,
              )}
          />
        {:else if meta?.type === "select" && !usesFreeTextValue(leaf)}
          <FilterCommandPicker
            fullWidth
            label={meta.label}
            ariaLabel={`Select ${meta.label.toLowerCase()}`}
            placeholder={`Filter ${meta.label.toLowerCase()}...`}
            allowCustom={leaf.conditionType === "transaction_merchant"}
            value={leaf.value ?? ""}
            options={valueOptions(leaf.conditionType)}
            onChange={(next) => updateLeaf(leaf, { value: next }, emit)}
          />
        {:else}
          <Input
            value={leaf.value ?? ""}
            {disabled}
            aria-label="Condition value"
            placeholder={valuePlaceholder(leaf)}
            autocomplete="off"
            spellcheck={leaf.operator !== "matches" &&
              leaf.operator !== "not_matches"}
            oninput={(event) =>
              updateLeaf(
                leaf,
                { value: (event.currentTarget as HTMLInputElement).value },
                emit,
              )}
          />
        {/if}
      </div>
    {:else}
      <div class="min-w-0 flex-[2_1_12rem] px-1 text-sm text-muted-foreground">
        {leaf.operator === "is_not_null" ? "is not empty" : "is empty"}
      </div>
    {/if}

    <Button
      type="button"
      variant="ghost"
      size="icon"
      class="ml-auto size-8 shrink-0 text-muted-foreground hover:text-destructive"
      aria-label="Remove condition"
      {disabled}
      onclick={remove}
    >
      <Trash2 class="size-4" />
    </Button>
  </div>
{/snippet}

{#if condition.conditionType === "compound"}
  <div
    class="flex min-w-0 flex-col gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3"
    data-rule-condition-group
  >
    <div class="flex items-center gap-2">
      <div class="min-w-0 flex-1">
        <Select.Root
          type="single"
          value={condition.operator}
          {disabled}
          onValueChange={(next) => {
            if (next) onChange({ ...condition, operator: next });
          }}
        >
          <Select.Trigger
            class="h-8 w-full max-w-64 min-w-0 overflow-hidden text-xs"
            style="width: 100%"
            aria-label={`Group operator: ${
              groupOperatorOptions.find(
                (option) => option.value === condition.operator,
              )?.label ?? condition.operator
            }`}
            title={groupOperatorOptions.find(
              (option) => option.value === condition.operator,
            )?.label ?? condition.operator}
          >
            <span class="min-w-0 truncate">
              {groupOperatorOptions.find(
                (option) => option.value === condition.operator,
              )?.label ?? condition.operator}
            </span>
          </Select.Trigger>
          <Select.Content aria-label="Group operator options">
            {#each groupOperatorOptions as option (option.value)}
              <Select.Item value={option.value}>{option.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="size-8 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label="Remove condition group"
        {disabled}
        onclick={onRemove}
      >
        <Trash2 class="size-4" />
      </Button>
    </div>

    <div class="flex min-w-0 flex-col gap-2 pl-3">
      {#each condition.subConditions ?? [] as sub, index (sub.id)}
        {@render LeafRow({
          leaf: sub,
          emit: (next) => updateSubCondition(index, next),
          remove: () => removeSubCondition(index),
        })}
      {/each}
      <FormAddButton label="Add condition" onclick={addSubCondition} />
    </div>
  </div>
{:else}
  {@render LeafRow({ leaf: condition, emit: onChange, remove: onRemove })}
{/if}
