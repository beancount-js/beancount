<script lang="ts">
  import Highlighter from "@lapis/ui/pages/Highlighter.svelte";
  import type { Parser } from "@lezer/common";

  let { code, parser }: { code: string; parser: Parser } = $props();
</script>

<Highlighter {code} {parser} />
