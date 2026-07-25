<script lang="ts">
  import { highlightCode } from "@lezer/highlight";
  import type { Parser } from "@lezer/common";
  import * as ScrollArea from "../shadcn/scroll-area";
  import { codeHighlighter } from "../forms/code-highlighter";

  type HighlighterProps = {
    code: string;
    parser: Parser;
    ariaLabel?: string;
  };

  let {
    code,
    parser,
    ariaLabel = "Highlighted source",
  }: HighlighterProps = $props();

  let output: HTMLPreElement | undefined;

  $effect(() => {
    if (!output) return;

    output.replaceChildren();
    const fragment = document.createDocumentFragment();

    function emit(text: string, classes: string) {
      const node = document.createTextNode(text);
      if (!classes) {
        fragment.appendChild(node);
        return;
      }
      const span = document.createElement("span");
      span.className = classes;
      span.appendChild(node);
      fragment.appendChild(span);
    }

    function emitBreak() {
      fragment.appendChild(document.createTextNode("\n"));
    }

    highlightCode(code, parser.parse(code), codeHighlighter, emit, emitBreak);
    output.appendChild(fragment);
  });
</script>

<ScrollArea.Root orientation="horizontal" class="w-full">
  <pre
    bind:this={output}
    class="beancount-highlighter whitespace-pre-wrap text-left"
    role="region"
    aria-label={ariaLabel}></pre>
</ScrollArea.Root>

<style>
  :global(.beancount-highlighter .beancount-code-comment) {
    color: var(--code-comment);
  }

  :global(.beancount-highlighter .beancount-code-keyword) {
    color: var(--code-keyword);
  }

  :global(.beancount-highlighter .beancount-code-string) {
    color: var(--code-string);
  }

  :global(.beancount-highlighter .beancount-code-value) {
    color: var(--code-value);
  }

  :global(.beancount-highlighter .beancount-code-function) {
    color: var(--code-function);
  }

  :global(.beancount-highlighter .beancount-code-property) {
    color: var(--code-property);
  }

  :global(.beancount-highlighter .beancount-code-operator) {
    color: var(--code-operator);
  }

  :global(.beancount-highlighter .beancount-code-punctuation) {
    color: var(--code-punctuation);
  }

  :global(.beancount-highlighter .beancount-code-invalid) {
    color: var(--destructive);
  }
</style>
