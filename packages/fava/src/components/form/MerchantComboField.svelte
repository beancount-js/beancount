<script lang="ts">
  import { type FormFieldRenderArgs } from "@beancount-js/forms";
  import MerchantPicker from "../MerchantPicker.svelte";
  import type { SourceFormContext } from "../../ingestion/source-form-config";

  let {
    root,
    value,
    field,
    context,
    readonly = false,
    update,
  }: FormFieldRenderArgs<unknown, SourceFormContext, string> = $props();

  const projectId = $derived(context?.projectId ?? "");
  const source = $derived.by(() => {
    if (!root || typeof root !== "object" || Array.isArray(root)) {
      return { id: "", name: "" };
    }
    const sourceRoot = root as { id?: unknown; name?: unknown };
    return {
      id: typeof sourceRoot.id === "string" ? sourceRoot.id : "",
      name: typeof sourceRoot.name === "string" ? sourceRoot.name : "",
    };
  });
</script>

{#if readonly}
  <output>{value || " "}</output>
{:else}
  <div data-merchant-field={field.id}>
    <MerchantPicker
      {projectId}
      sourceId={source.id}
      sourceName={source.name}
      value={value ?? ""}
      label="Merchant"
      ariaLabel={field.ariaLabel ?? field.label}
      placeholder="Search saved merchants..."
      emptyOption={{
        label: "No merchant selected",
        description:
          "Choose a saved merchant to use its logo for this connection.",
      }}
      onChange={(next) => void update(next)}
    />
  </div>
{/if}
