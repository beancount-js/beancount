<script lang="ts">
  import { FormField } from "@beancount-js/forms";
  import MerchantPicker from "./MerchantPicker.svelte";

  type Props = {
    projectId: string;
    domain?: string;
    searchText?: string;
    sourceId?: string;
    sourceName?: string;
    attachedMerchantId?: string;
    onAttach?: (merchant: {
      merchantId: string;
      canonicalName: string;
      domain?: string;
      description?: string;
    }) => void;
  };

  let {
    projectId,
    domain = "",
    searchText = "",
    sourceId = "manual-review",
    sourceName = "",
    attachedMerchantId = $bindable(""),
    onAttach,
  }: Props = $props();

  const controlId = $props.id();

  let loadError = $state("");
</script>

<FormField
  label="Existing merchant"
  as="div"
  align="center"
  {controlId}
  messages={loadError ? [loadError] : []}
>
  <MerchantPicker
    {projectId}
    {domain}
    {searchText}
    {sourceId}
    {sourceName}
    autoAttachExactDomain
    label="Existing merchant"
    ariaLabel="Select existing merchant"
    emptyOption={{
      label: "Create new merchant",
      description: "Save the merchant details from this transaction.",
    }}
    bind:value={attachedMerchantId}
    {onAttach}
    onError={(message) => (loadError = message)}
  />
</FormField>
