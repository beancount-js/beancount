<script lang="ts">
  import { highlightCode } from "@lezer/highlight";
  import { Parser } from "@lezer/common";
  import { classHighlighter } from "../codemirror/extensions/classHighlighter";
  type HighlighterProps = {
    code: string;
    parser: Parser;
  };

  let { code, parser }: HighlighterProps = $props();

  const useHighligter = (el: HTMLPreElement) => {
    if (!el) {
      return;
    }
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
</script>

<div>
  <pre
    class="overflow-x-auto whitespace-pre-wrap text-left"
    use:useHighligter></pre>
</div>
