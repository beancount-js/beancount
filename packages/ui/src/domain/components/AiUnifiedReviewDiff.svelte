<script lang="ts">
  import { unifiedDiff } from "@lapismd/design-core/forms";

  export let before = "";
  export let after = "";

  $: parts = unifiedDiff(before, after);
</script>

<pre
  class="max-h-60 overflow-auto rounded-md border bg-muted/35 p-2 text-xs leading-5"><code
    >{#each parts as part, partIndex (`${part.type}-${partIndex}`)}{#each part.lines as line, lineIndex (`${line.type}-${lineIndex}`)}<span
          class:line-removed={line.type === "removed"}
          class:line-added={line.type === "added"}
          class="block whitespace-pre-wrap"
          >{line.type === "removed"
            ? "− "
            : line.type === "added"
              ? "+ "
              : "  "}{#each line.segments as segment, segmentIndex (`${segment.type}-${segmentIndex}`)}<span
              class:segment-removed={segment.type === "removed"}
              class:segment-added={segment.type === "added"}
              >{segment.text}</span
            >{/each}</span
        >{/each}{/each}</code
  ></pre>

<style>
  .line-removed {
    background: color-mix(in srgb, var(--destructive) 10%, transparent);
    color: var(--destructive);
  }
  .line-added {
    background: color-mix(in srgb, var(--primary) 10%, transparent);
  }
  .segment-removed {
    text-decoration: line-through;
    font-weight: 650;
  }
  .segment-added {
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
