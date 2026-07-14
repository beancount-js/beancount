<script lang="ts">
  import { onMount } from "svelte";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import EyeOff from "lucide-svelte/icons/eye-off";
  import SlidersHorizontal from "lucide-svelte/icons/sliders-horizontal";
  import Sparkles from "lucide-svelte/icons/sparkles";
  import { Button } from "$lib/components/ui/button";
  import * as Select from "$lib/components/ui/select";
  import type { InlineAiRequest } from "../studio/workspace";

  type ModelOption = {
    value: string;
    label: string;
  };

  const MODEL_STORAGE_KEY = "beancount-studio:ai-model";
  const CONTEXT_STORAGE_KEY = "beancount-studio:ai-include-selection";
  const VISIBILITY_STORAGE_KEY = "beancount-studio:ai-visibility";
  const modelOptions: ModelOption[] = [
    { value: "", label: "Codex default" },
    { value: "gpt-5.5", label: "GPT-5.5" },
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "gpt-5.3-codex-spark", label: "Codex Spark" },
  ];

  export let projectName = "Ledger";
  export let hasProject = false;
  export let isWeb = false;
  export let inlineRequest: InlineAiRequest | undefined;
  export let onAsk: (
    question: string,
    context?: InlineAiRequest,
    model?: string,
  ) => Promise<string>;

  let visibility: "expanded" | "collapsed" | "hidden" = "hidden";
  let model = "";
  let includeSelection = true;
  let settingsLoaded = false;
  let question = "";
  let sending = false;
  let reply = "";
  let requestKey = "";

  $: selectedModel =
    modelOptions.find((option) => option.value === model) ?? modelOptions[0];
  $: if (settingsLoaded) {
    localStorage.setItem(MODEL_STORAGE_KEY, model);
    localStorage.setItem(CONTEXT_STORAGE_KEY, String(includeSelection));
    localStorage.setItem(VISIBILITY_STORAGE_KEY, visibility);
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

  onMount(() => {
    const storedModel = localStorage.getItem(MODEL_STORAGE_KEY) ?? "";
    const storedVisibility = localStorage.getItem(VISIBILITY_STORAGE_KEY);

    if (modelOptions.some((option) => option.value === storedModel)) {
      model = storedModel;
    }
    includeSelection = localStorage.getItem(CONTEXT_STORAGE_KEY) !== "false";
    if (
      storedVisibility === "expanded" ||
      storedVisibility === "collapsed" ||
      storedVisibility === "hidden"
    ) {
      visibility = storedVisibility;
    }
    settingsLoaded = true;
  });

  async function ask() {
    if (!question.trim() || sending || !hasProject) return;
    sending = true;
    reply = isWeb
      ? "AI is available when this project is opened through the local Beancount Studio server."
      : "";
    if (!isWeb) {
      try {
        reply = await onAsk(
          question,
          includeSelection ? inlineRequest : undefined,
          model || undefined,
        );
      } catch (error) {
        reply = error instanceof Error ? error.message : String(error);
      }
    }
    sending = false;
  }

  function resetDraft() {
    question = "";
    reply = "";
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
{:else}
  <section
    class="fixed bottom-4 left-4 right-4 z-30 mx-auto flex max-h-[min(62vh,460px)] max-w-2xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl lg:static lg:z-auto lg:mx-0 lg:h-full lg:max-h-none lg:w-96 lg:max-w-none lg:shrink-0"
    aria-label="Account AI"
  >
    <div class="flex h-11 shrink-0 items-center gap-2 border-b px-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Collapse AI"
        onclick={() => (visibility = "collapsed")}
      >
        <ChevronDown />
      </Button>
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <Sparkles class="shrink-0" />
        <p class="min-w-0 truncate text-sm font-medium">AI · {projectName}</p>
        <Select.Root
          type="single"
          value={model}
          onValueChange={(next: string) => (model = next)}
        >
          <Select.Trigger
            class="h-7 min-w-0 max-w-36 border-0 bg-secondary px-2 text-xs shadow-none"
            aria-label="Select Codex model"
          >
            {selectedModel.label}
          </Select.Trigger>
          <Select.Content>
            {#each modelOptions as option (option.value)}
              <Select.Item value={option.value}>{option.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <details class="relative">
        <summary
          class="flex size-9 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden"
          aria-label="AI settings"
          title="AI settings"
        >
          <SlidersHorizontal />
        </summary>
        <div
          class="absolute right-0 top-10 z-40 flex w-56 flex-col gap-2 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md"
        >
          <label class="flex cursor-pointer items-start gap-2">
            <input type="checkbox" bind:checked={includeSelection} />
            <span>Include selected ledger context</span>
          </label>
          <Button
            variant="ghost"
            size="sm"
            class="w-full justify-start"
            onclick={resetDraft}
          >
            Reset question and answer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="w-full justify-start"
            onclick={() => (visibility = "hidden")}
          >
            <EyeOff data-icon="inline-start" />
            Hide AI panel
          </Button>
        </div>
      </details>
    </div>
    <div class="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <p class="text-sm text-muted-foreground">
        {#if hasProject}
          Ask about the state of accounts. Responses use only the selected
          ledger project.
        {:else}
          Open a ledger project to ask about its accounts.
        {/if}
      </p>
      <textarea
        bind:value={question}
        class="min-h-24 w-full resize-y rounded-md border bg-background p-2 text-sm"
        placeholder="Which accounts changed this month?"
        disabled={!hasProject}
      ></textarea>
      <div class="flex justify-end">
        <Button
          disabled={sending || !question.trim() || !hasProject}
          onclick={() => void ask()}
        >
          <Sparkles data-icon="inline-start" />
          {sending ? "Thinking…" : "Ask AI"}
        </Button>
      </div>
      {#if reply}
        <pre
          class="min-h-0 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{reply}</pre>
      {/if}
    </div>
  </section>
{/if}
