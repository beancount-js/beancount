<script lang="ts">
  import { highlightCode } from "@lezer/highlight";
  import { Parser } from "@lezer/common";
  import { classHighlighter } from "./classHighlighter";
  import * as ScrollArea from "$lib/components/ui/scroll-area";
  export let code: string;
  export let parser: Parser;
  let contentEl: HTMLPreElement;

  $: useHighligter = (el: HTMLPreElement) => {
    if (!el) {
      return;
    }
    el.innerHTML = "";
    function emit(text: string, classes: string) {
      let node: Text | HTMLSpanElement = document.createTextNode(text);
      if (classes) {
        let span = document.createElement("span");
        span.appendChild(node);
        span.className = classes;
        node = span;
      }
      el.appendChild(node);
    }

    function emitBreak() {
      el.appendChild(document.createTextNode("\n"));
    }

    highlightCode(code, parser.parse(code), classHighlighter, emit, emitBreak);
  };

  $: useHighligter(contentEl);
</script>

<ScrollArea.Root orientation="horizontal" class="w-full">
  <pre class="whitespace-pre-wrap text-left" bind:this={contentEl}></pre>
</ScrollArea.Root>
