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
  <ScrollArea.Root orientation="both" class="cn-forms-reviewdiff-28-1">
    <pre
      class="cn-forms-reviewdiff-31-1"
      role="region"
      aria-label={ariaLabel}><code
        >{#each parts as part, partIndex (`${part.type}-${partIndex}`)}{#each part.lines as line, lineIndex (`${line.type}-${lineIndex}`)}<span
              class:beancount-review-diff__line--removed={line.type ===
                "removed"}
              class:beancount-review-diff__line--added={line.type === "added"}
              class="cn-forms-reviewdiff-38-1"
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
  <section class="cn-forms-reviewdiff-56-1" aria-label={ariaLabel}>
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
