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
    class="cn-navigation-savedqueryhistory-67-1"
    type="multiple"
    value={[...expandedIds]}
    onValueChange={updateExpansion}
    aria-label={ariaLabel}
  >
    {#each queries as query (query.id)}
      <Accordion.Item
        value={query.id}
        class={cn(
          "cn-navigation-savedqueryhistory-77-1",
          selectedId === query.id && "cn-navigation-savedqueryhistory-78-1",
        )}
      >
        <div class="cn-navigation-savedqueryhistory-82-1 cn-group">
          <div class="cn-navigation-savedqueryhistory-84-1">
            <Accordion.Trigger
              indicatorPosition="start"
              class="cn-navigation-savedqueryhistory-87-1"
              onclick={() => onSelect?.(query)}
            >
              <code class="cn-navigation-savedqueryhistory-91-1">
                {query.label ?? query.query}
              </code>
            </Accordion.Trigger>
          </div>
          <div class="cn-navigation-savedqueryhistory-97-1">
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
        <Accordion.Content class="cn-navigation-savedqueryhistory-122-1">
          <div class="cn-navigation-savedqueryhistory-123-1">
            {@render details?.(query)}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    {/each}
  </Accordion.Root>
{:else}
  <p class="cn-navigation-savedqueryhistory-131-1">{emptyLabel}</p>
{/if}
