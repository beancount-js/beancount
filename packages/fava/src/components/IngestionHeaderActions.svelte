<script lang="ts">
  import BookOpen from "lucide-svelte/icons/book-open";
  import ClipboardList from "lucide-svelte/icons/clipboard-list";
  import Pencil from "lucide-svelte/icons/pencil";
  import { FormToolbar } from "@beancount-js/forms";
  import { Button } from "$lib/components/ui/button";
  import { Switch } from "$lib/components/ui/switch";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
</script>

{#if $ingestionHeaderActions}
  {@const header = $ingestionHeaderActions}
  <div
    class="flex flex-wrap items-center justify-end gap-2"
    data-slot="ingestion-header-actions"
  >
    {#if header.saveHint}
      <p class="text-xs text-muted-foreground" role="status">{header.saveHint}</p>
    {/if}
    {#if header.configReady && !header.yamlMode && !header.previewMode}
      <FormToolbar
        collapsedAll={header.sectionsCollapsedAll}
        collapseLabel="Collapse all source sections"
        expandLabel="Expand all source sections"
        onToggleCollapse={header.onToggleCollapse}
      />
    {/if}
    {#if header.configReady}
      <div class="flex items-center gap-2">
        <Switch
          id="ingestion-yaml-mode"
          size="sm"
          checked={header.yamlMode}
          aria-label="YAML mode"
          onCheckedChange={header.onYamlMode}
        />
        <label for="ingestion-yaml-mode" class="text-sm font-semibold"
          >YAML</label
        >
      </div>
      {#if !header.yamlMode}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label={header.previewMode
                  ? "Switch to edit mode"
                  : "Switch to preview mode"}
                title={header.previewMode
                  ? "Switch to edit mode"
                  : "Switch to preview mode"}
                onclick={(event) => {
                  props.onclick?.(event);
                  header.onTogglePreview();
                }}
              >
                {#if header.previewMode}
                  <Pencil />
                {:else}
                  <BookOpen />
                {/if}
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>
            {header.previewMode ? "Edit" : "Preview"}
          </Tooltip.Content>
        </Tooltip.Root>
      {/if}
    {/if}
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            type="button"
            size="icon"
            variant="ghost"
            class="size-8"
            aria-label="Review imports"
            onclick={(event) => {
              props.onclick?.(event);
              header.onReviewImports();
            }}
          >
            <ClipboardList />
          </Button>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content>Review imports</Tooltip.Content>
    </Tooltip.Root>
  </div>
{/if}
