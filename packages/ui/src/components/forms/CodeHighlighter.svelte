<script lang="ts">
  import type { Parser } from "@lezer/common";
  import { highlightCode } from "@lezer/highlight";
  import * as ScrollArea from "../shadcn/scroll-area";
  import { codeHighlighter } from "./code-highlighter";

  let {
    code,
    parser,
    ariaLabel = "Highlighted source",
  }: {
    /** The display-ready source text. This component does not edit it. */
    code: string;
    /** A Lezer parser for the language represented by `code`. */
    parser: Parser;
    /** Labels the read-only source region. The enclosing scroll area is keyboard-reachable. */
    ariaLabel?: string;
  } = $props();

  let source: HTMLPreElement | undefined;

  $effect(() => {
    if (!source) return;

    source.replaceChildren();
    const fragment = document.createDocumentFragment();

    function emit(text: string, classes: string) {
      const textNode = document.createTextNode(text);
      if (!classes) {
        fragment.appendChild(textNode);
        return;
      }

      const span = document.createElement("span");
      span.className = classes;
      span.appendChild(textNode);
      fragment.appendChild(span);
    }

    function emitBreak() {
      fragment.appendChild(document.createTextNode("\n"));
    }

    highlightCode(code, parser.parse(code), codeHighlighter, emit, emitBreak);
    source.appendChild(fragment);
  });
</script>

<ScrollArea.Root orientation="horizontal" class="w-full">
  <pre
    bind:this={source}
    class="beancount-code-highlighter min-w-full rounded-lg border border-border/80 bg-muted/35 p-3 font-mono text-xs leading-relaxed text-foreground"
    role="region"
    aria-label={ariaLabel}></pre>
</ScrollArea.Root>

<style>
  :global(.beancount-code-highlighter .beancount-code-comment) {
    color: var(--code-comment);
  }

  :global(.beancount-code-highlighter .beancount-code-keyword) {
    color: var(--code-keyword);
  }

  :global(.beancount-code-highlighter .beancount-code-string) {
    color: var(--code-string);
  }

  :global(.beancount-code-highlighter .beancount-code-value) {
    color: var(--code-value);
  }

  :global(.beancount-code-highlighter .beancount-code-function) {
    color: var(--code-function);
  }

  :global(.beancount-code-highlighter .beancount-code-property) {
    color: var(--code-property);
  }

  :global(.beancount-code-highlighter .beancount-code-operator) {
    color: var(--code-operator);
  }

  :global(.beancount-code-highlighter .beancount-code-punctuation) {
    color: var(--code-punctuation);
  }

  :global(.beancount-code-highlighter .beancount-code-invalid) {
    color: var(--destructive);
  }
</style>
