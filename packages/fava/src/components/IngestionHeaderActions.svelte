<script lang="ts">
  import BookOpen from "lucide-svelte/icons/book-open";
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import ClipboardList from "lucide-svelte/icons/clipboard-list";
  import Landmark from "lucide-svelte/icons/landmark";
  import Pencil from "lucide-svelte/icons/pencil";
  import RefreshCw from "lucide-svelte/icons/refresh-cw";
  import Settings2 from "lucide-svelte/icons/settings-2";
  import Sparkles from "lucide-svelte/icons/sparkles";
  import { FormToolbar } from "@beancount-js/forms";
  import CycleSelect from "./CycleSelect.svelte";
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
    {#if header.kind === "review"}
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              type="button"
              size="sm"
              class="h-8"
              aria-label={header.acceptCount
                ? `Accept ${header.acceptCount} reviewed transaction${header.acceptCount === 1 ? "" : "s"}`
                : "Accept reviewed transactions"}
              disabled={!header.canAccept || header.acceptBusy}
              onclick={(event) => {
                props.onclick?.(event);
                header.onAccept();
              }}
            >
              Accept{header.acceptCount ? ` ${header.acceptCount}` : ""}
            </Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content>
          {header.acceptBusy
            ? "Accepting…"
            : header.acceptCount
              ? `Write ${header.acceptCount} reviewed transaction${header.acceptCount === 1 ? "" : "s"} to the ledger`
              : "No reviewed transactions ready to accept"}
        </Tooltip.Content>
      </Tooltip.Root>
      <CycleSelect
        value={header.sourceId}
        options={header.sourceOptions}
        label="Source"
        ariaLabel="Select source"
        onChange={header.onSourceChange}
      />
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              type="button"
              size="icon"
              variant="ghost"
              class="size-8"
              aria-label={header.groupsCollapsedAll
                ? "Expand all date groups"
                : "Collapse all date groups"}
              onclick={(event) => {
                props.onclick?.(event);
                header.onToggleCollapseGroups();
              }}
            >
              {#if header.groupsCollapsedAll}
                <ChevronsUpDown />
              {:else}
                <ChevronsDownUp />
              {/if}
            </Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content>
          {header.groupsCollapsedAll
            ? "Expand all date groups"
            : "Collapse all date groups"}
        </Tooltip.Content>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              type="button"
              size="icon"
              variant="ghost"
              class="size-8"
              aria-label="Open Accounts"
              onclick={(event) => {
                props.onclick?.(event);
                header.onOpenAccounts();
              }}
            >
              <Landmark />
            </Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content>Open Accounts</Tooltip.Content>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              type="button"
              size="icon"
              variant="ghost"
              class="size-8"
              aria-label="Force re-fetch"
              title="Prefer Sync on the Accounts screen"
              disabled={!header.canForceRefetch}
              onclick={(event) => {
                props.onclick?.(event);
                header.onForceRefetch();
              }}
            >
              <RefreshCw />
            </Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content>Force re-fetch</Tooltip.Content>
      </Tooltip.Root>
      {#if header.canRerunAi || header.aiRerunBusy}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label="Re-run AI enrichment"
                title="Re-run AI merchant enrichment and categorisation on current proposals"
                disabled={!header.canRerunAi || header.aiRerunBusy}
                onclick={(event) => {
                  props.onclick?.(event);
                  header.onRerunAi();
                }}
              >
                <Sparkles class={header.aiRerunBusy ? "animate-pulse" : ""} />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>
            {header.aiRerunBusy
              ? "AI enrichment running…"
              : "Re-run AI enrichment"}
          </Tooltip.Content>
        </Tooltip.Root>
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
              aria-label="Edit sources"
              onclick={(event) => {
                props.onclick?.(event);
                header.onEditSources();
              }}
            >
              <Settings2 />
            </Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content>Edit sources</Tooltip.Content>
      </Tooltip.Root>
    {:else}
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
    {/if}
  </div>
{/if}
