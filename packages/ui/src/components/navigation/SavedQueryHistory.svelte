<script lang="ts">
  import type { Snippet } from "svelte";
  import Copy from "lucide-svelte/icons/copy";
  import Trash from "lucide-svelte/icons/trash";
  import * as Accordion from "../shadcn/accordion";
  import { Button } from "../shadcn/button";
  import { cn } from "../../lib/utils";

  /** A saved query presented in the workspace history. */
  export type SavedQueryHistoryItem = {
    id: string;
    query: string;
    /** Optional short accessible name when the query itself is not suitable. */
    label?: string;
  };

  /**
   * Controlled, expandable saved-query history.
   *
   * Applications retain persistence, query execution, result rendering, and
   * clipboard effects. Provide `details` to render query-specific results in
   * the open panel.
   */
  let {
    queries,
    selectedId,
    expandedIds = [],
    ariaLabel = "Saved query history",
    emptyLabel = "No saved queries yet.",
    onSelect,
    onExpandedIdsChange,
    onCopy,
    onDelete,
    details,
  }: {
    queries: readonly SavedQueryHistoryItem[];
    selectedId?: string;
    expandedIds?: readonly string[];
    ariaLabel?: string;
    emptyLabel?: string;
    onSelect?: (query: SavedQueryHistoryItem) => void;
    onExpandedIdsChange?: (ids: string[]) => void;
    onCopy?: (query: SavedQueryHistoryItem) => void;
    onDelete?: (query: SavedQueryHistoryItem) => void;
    details?: Snippet<[SavedQueryHistoryItem]>;
  } = $props();

  function updateExpansion(items: string[] | undefined): void {
    onExpandedIdsChange?.(items ?? []);
  }

  function handleCopy(event: MouseEvent, query: SavedQueryHistoryItem): void {
    event.preventDefault();
    event.stopPropagation();
    onCopy?.(query);
  }

  function handleDelete(event: MouseEvent, query: SavedQueryHistoryItem): void {
    event.preventDefault();
    event.stopPropagation();
    onDelete?.(query);
  }
</script>

{#if queries.length}
  <Accordion.Root
    class="flex w-full flex-col gap-3 pt-3"
    type="multiple"
    value={[...expandedIds]}
    onValueChange={updateExpansion}
    aria-label={ariaLabel}
  >
    {#each queries as query (query.id)}
      <Accordion.Item
        value={query.id}
        class={cn(
          "overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm data-[state=open]:bg-muted/50",
          selectedId === query.id && "ring-1 ring-primary/30",
        )}
      >
        <div
          class="group flex min-h-14 items-stretch gap-3 transition-colors hover:bg-muted/50"
        >
          <div class="flex min-w-0 flex-1">
            <Accordion.Trigger
              indicatorPosition="start"
              class="h-full w-full min-w-0 gap-3 py-0 pl-4 text-left text-xs hover:no-underline"
              onclick={() => onSelect?.(query)}
            >
              <code
                class="min-w-0 flex-1 break-words font-mono text-xs leading-relaxed"
              >
                {query.label ?? query.query}
              </code>
            </Accordion.Trigger>
          </div>
          <div class="flex shrink-0 items-center gap-1 pr-4">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Copy query: ${query.label ?? query.query}`}
              title="Copy query"
              disabled={!onCopy}
              onclick={(event) => handleCopy(event, query)}
            >
              <Copy aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete query: ${query.label ?? query.query}`}
              title="Delete query"
              disabled={!onDelete}
              onclick={(event) => handleDelete(event, query)}
            >
              <Trash aria-hidden="true" />
            </Button>
          </div>
        </div>
        <Accordion.Content class="border-t bg-muted/20 [&>div]:p-0">
          <div class="px-4 pb-4">
            {@render details?.(query)}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    {/each}
  </Accordion.Root>
{:else}
  <p class="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
{/if}
