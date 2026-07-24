<script lang="ts">
  import type { DetectionRule, RuleRegistryMeta } from "@beancount-js/beangulp";
  import { RuleEditorSheet as SharedRuleEditorSheet } from "@beancount-js/ui/forms";

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
</script>

<SharedRuleEditorSheet
  bind:open
  {rule}
  {registry}
  {accounts}
  {onSave}
  {onClosed}
/>
