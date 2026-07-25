<script lang="ts">
  import Trash2 from "lucide-svelte/icons/trash-2";
  import {
    newRuleId,
    type RuleCondition,
    type RuleConditionType,
    type RuleRegistryMeta,
  } from "@beancount-js/beangulp";
  import FilterCommandPicker from "../FilterCommandPicker.svelte";
  import FormAddButton from "../FormAddButton.svelte";
  import type { FilterCommandOption } from "../picker-options";
  import { Button } from "../../shadcn/button";
  import { Input } from "../../shadcn/input";
  import * as Select from "../../shadcn/select";

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

  function filterMeta(key: RuleConditionType) {
    return registry.filters.find((filter) => filter.key === key);
  }

  function fieldOptions() {
    return registry.filters.map((filter) => ({
      value: filter.key,
      label: filter.label,
    }));
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
      value: nextOperator === "is_null" ? null : (current.value ?? ""),
    });
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
  <div class="cn-forms-rules-ruleconditionrow-136-1" data-rule-condition-row>
    <div class="cn-forms-rules-ruleconditionrow-139-1">
      <Select.Root
        type="single"
        value={leaf.conditionType}
        {disabled}
        onValueChange={(next) => {
          if (next) changeField(leaf, next as RuleConditionType, emit);
        }}
      >
        <Select.Trigger
          class="cn-forms-rules-ruleconditionrow-148-1"
          aria-label="Condition field"
        >
          {meta?.label ?? leaf.conditionType}
        </Select.Trigger>
        <Select.Content>
          {#each fieldOptions() as option (option.value)}
            <Select.Item value={option.value}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <div class="cn-forms-rules-ruleconditionrow-159-1">
      <Select.Root
        type="single"
        value={leaf.operator}
        {disabled}
        onValueChange={(next) => {
          if (next) changeOperator(leaf, next, emit);
        }}
      >
        <Select.Trigger
          class="cn-forms-rules-ruleconditionrow-168-1"
          aria-label="Condition operator"
        >
          {operators.find((operator) => operator.value === leaf.operator)
            ?.label ?? leaf.operator}
        </Select.Trigger>
        <Select.Content>
          {#each operators as operator (operator.value)}
            <Select.Item value={operator.value}>{operator.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    {#if leaf.operator !== "is_null"}
      <div class="cn-forms-rules-ruleconditionrow-181-1">
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
        {:else if meta?.type === "select"}
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
            placeholder="Value"
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
      <div class="cn-forms-rules-ruleconditionrow-221-1">is empty</div>
    {/if}

    <Button
      type="button"
      variant="ghost"
      size="icon"
      class="cn-forms-rules-ruleconditionrow-230-1"
      aria-label="Remove condition"
      {disabled}
      onclick={remove}
    >
      <Trash2 class="cn-forms-rules-ruleconditionrow-235-1" />
    </Button>
  </div>
{/snippet}

{#if condition.conditionType === "compound"}
  <div class="cn-forms-rules-ruleconditionrow-242-1" data-rule-condition-group>
    <div class="cn-forms-rules-ruleconditionrow-245-1">
      <div class="cn-forms-rules-ruleconditionrow-246-1">
        <Select.Root
          type="single"
          value={condition.operator}
          {disabled}
          onValueChange={(next) => {
            if (next) onChange({ ...condition, operator: next });
          }}
        >
          <Select.Trigger
            class="cn-forms-rules-ruleconditionrow-256-1"
            aria-label="Group operator"
          >
            {groupOperatorOptions.find(
              (option) => option.value === condition.operator,
            )?.label ?? condition.operator}
          </Select.Trigger>
          <Select.Content>
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
        class="cn-forms-rules-ruleconditionrow-274-1"
        aria-label="Remove condition group"
        {disabled}
        onclick={onRemove}
      >
        <Trash2 class="cn-forms-rules-ruleconditionrow-279-1" />
      </Button>
    </div>

    <div class="cn-forms-rules-ruleconditionrow-283-1">
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
