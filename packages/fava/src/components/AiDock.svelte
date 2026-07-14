<script lang="ts">
  import { onMount } from "svelte";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import PanelRightOpen from "lucide-svelte/icons/panel-right-open";
  import PictureInPicture from "lucide-svelte/icons/picture-in-picture";
  import Sparkles from "lucide-svelte/icons/sparkles";
  import { Button } from "$lib/components/ui/button";
  import type { InlineAiRequest } from "../studio/workspace";

  export let projectName = "Ledger";
  export let isWeb = false;
  export let inlineRequest: InlineAiRequest | undefined;
  export let onAsk: (question: string, context?: InlineAiRequest) => Promise<string>;

  let placement: "floating" | "right" = "floating";
  let visibility: "expanded" | "collapsed" | "hidden" = "hidden";
  let question = "";
  let sending = false;
  let reply = "";
  let requestKey = "";

  onMount(() => {
    const storedPlacement = localStorage.getItem("beancount-studio:ai-placement");
    const storedVisibility = localStorage.getItem("beancount-studio:ai-visibility");
    if (storedPlacement === "floating" || storedPlacement === "right") placement = storedPlacement;
    if (storedVisibility === "expanded" || storedVisibility === "collapsed" || storedVisibility === "hidden") {
      visibility = storedVisibility;
    }
  });

  $: if (typeof localStorage !== "undefined") {
    localStorage.setItem("beancount-studio:ai-placement", placement);
    localStorage.setItem("beancount-studio:ai-visibility", visibility);
  }
  $: if (inlineRequest) {
    const key = `${inlineRequest.path}:${inlineRequest.fromLine}:${inlineRequest.toLine}:${inlineRequest.text}`;
    if (key !== requestKey) {
      requestKey = key;
      question = inlineRequest.text
        ? `What should I understand about this selection in ${inlineRequest.path}, lines ${inlineRequest.fromLine}-${inlineRequest.toLine}?\n\n${inlineRequest.text}`
        : `What should I understand about ${inlineRequest.path}, lines ${inlineRequest.fromLine}-${inlineRequest.toLine}?`;
      visibility = "expanded";
    }
  }

  async function ask() {
    if (!question.trim() || sending) return;
    sending = true;
    reply = isWeb
      ? "AI is available when this project is opened through the local Beancount Studio server."
      : "";
    if (!isWeb) {
      try {
        reply = await onAsk(question, inlineRequest);
      } catch (error) {
        reply = error instanceof Error ? error.message : String(error);
      }
    }
    sending = false;
  }
</script>

{#if visibility !== "expanded"}
  <div class="fixed bottom-4 right-4 z-30">
    <Button
      variant="outline"
      size="icon"
      class="rounded-full bg-background shadow-lg"
      aria-label="Open account AI"
      title="Ask about account state"
      onclick={() => (visibility = "expanded")}
    >
      <Sparkles />
    </Button>
  </div>
{:else if placement === "right"}
  <aside class="fixed inset-y-0 right-0 z-30 flex w-96 max-w-[calc(100vw-3rem)] flex-col border-l bg-background shadow-xl" aria-label="Account AI">
    <div class="flex h-11 items-center justify-between gap-2 border-b px-2">
      <Button variant="ghost" size="icon" aria-label="Collapse AI" onclick={() => (visibility = "collapsed")}>
        <ChevronDown />
      </Button>
      <div class="min-w-0 flex-1 truncate text-sm font-medium">AI · {projectName}</div>
      <Button variant="ghost" size="icon" aria-label="Float AI" title="Float AI" onclick={() => (placement = "floating")}>
        <PictureInPicture />
      </Button>
    </div>
    <div class="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <p class="text-sm text-muted-foreground">Ask about the state of accounts. Responses use only the selected ledger project.</p>
      <textarea bind:value={question} class="min-h-28 w-full resize-y rounded-md border bg-background p-2 text-sm" placeholder="Which accounts changed this month?"></textarea>
      <Button disabled={sending || !question.trim()} onclick={() => void ask()}>
        <Sparkles data-icon="inline-start" />
        {sending ? "Thinking…" : "Ask AI"}
      </Button>
      {#if reply}<pre class="min-h-0 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{reply}</pre>{/if}
    </div>
  </aside>
{:else}
  <section class="fixed bottom-4 left-4 right-4 z-30 mx-auto flex max-h-[min(62vh,460px)] max-w-2xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl" aria-label="Account AI">
    <div class="flex h-11 items-center justify-between gap-2 border-b px-2">
      <Button variant="ghost" size="icon" aria-label="Collapse AI" onclick={() => (visibility = "collapsed")}>
        <ChevronDown />
      </Button>
      <div class="min-w-0 flex-1 truncate text-sm font-medium">AI · {projectName}</div>
      <Button variant="ghost" size="icon" aria-label="Pin AI to right sidebar" title="Pin to right sidebar" onclick={() => (placement = "right")}>
        <PanelRightOpen />
      </Button>
    </div>
    <div class="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <textarea bind:value={question} class="min-h-24 w-full resize-y rounded-md border bg-background p-2 text-sm" placeholder="Which accounts changed this month?"></textarea>
      <div class="flex justify-end"><Button disabled={sending || !question.trim()} onclick={() => void ask()}><Sparkles data-icon="inline-start" />{sending ? "Thinking…" : "Ask AI"}</Button></div>
      {#if reply}<pre class="min-h-0 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{reply}</pre>{/if}
    </div>
  </section>
{/if}
