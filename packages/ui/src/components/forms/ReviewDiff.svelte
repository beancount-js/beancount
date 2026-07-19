<script lang="ts">
  import * as ScrollArea from "../shadcn/scroll-area";
  import { unifiedDiff } from "./review-diff";

  let {
    before,
    after,
    ariaLabel = "Proposed source changes",
    emptyLabel = "No source changes to review.",
  }: {
    /** The current display-ready source text. */
    before: string;
    /** The proposed display-ready source text. */
    after: string;
    /** Labels the read-only diff region. */
    ariaLabel?: string;
    /** Explains the equal-source state. */
    emptyLabel?: string;
  } = $props();

  const parts = $derived(unifiedDiff(before, after));
  const changed = $derived(before !== after);
</script>

{#if changed}
  <ScrollArea.Root
    orientation="both"
    class="h-60 rounded-lg border border-border/80 bg-muted/35"
  >
    <pre
      class="beancount-review-diff min-w-full p-3 font-mono text-xs leading-5 text-foreground"
      role="region"
      aria-label={ariaLabel}><code
        >{#each parts as part, partIndex (`${part.type}-${partIndex}`)}{#each part.lines as line, lineIndex (`${line.type}-${lineIndex}`)}<span
              class:beancount-review-diff__line--removed={line.type ===
                "removed"}
              class:beancount-review-diff__line--added={line.type === "added"}
              class="beancount-review-diff__line block whitespace-pre-wrap"
              data-review-diff-line={line.type}
              >{line.type === "removed"
                ? "− "
                : line.type === "added"
                  ? "+ "
                  : "  "}{#each line.segments as segment, segmentIndex (`${segment.type}-${segmentIndex}`)}<span
                  class:beancount-review-diff__segment--removed={segment.type ===
                    "removed"}
                  class:beancount-review-diff__segment--added={segment.type ===
                    "added"}
                  data-review-diff-segment={segment.type}>{segment.text}</span
                >{/each}</span
            >{/each}{/each}</code
      ></pre>
  </ScrollArea.Root>
{:else}
  <section
    class="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-5 text-sm text-muted-foreground"
    aria-label={ariaLabel}
  >
    {emptyLabel}
  </section>
{/if}

<style>
  .beancount-review-diff__line--removed {
    background: color-mix(in srgb, var(--destructive) 12%, transparent);
    color: var(--destructive);
  }

  .beancount-review-diff__line--added {
    background: color-mix(in srgb, var(--primary) 12%, transparent);
  }

  .beancount-review-diff__segment--removed {
    font-weight: 650;
    text-decoration: line-through;
  }

  .beancount-review-diff__segment--added {
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
