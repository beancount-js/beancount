<svelte:options runes={false} />

<script lang="ts">
  import { onDestroy } from "svelte";
  import { Brain } from "@lucide/svelte";
  import { Check } from "@lucide/svelte";
  import { ChevronDown } from "@lucide/svelte";
  import { EyeOff } from "@lucide/svelte";
  import { FilePenLine } from "@lucide/svelte";
  import { LoaderCircle } from "@lucide/svelte";
  import { Send } from "@lucide/svelte";
  import { SlidersHorizontal } from "@lucide/svelte";
  import { Sparkles } from "@lucide/svelte";
  import { Wrench } from "@lucide/svelte";
  import { X } from "@lucide/svelte";
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as AlertDialog from "@lapismd/design-core/shadcn/alert-dialog";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import * as ScrollArea from "@lapismd/design-core/shadcn/scroll-area";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import { Textarea } from "@lapismd/design-core/shadcn/textarea";
  import {
    applyAgentEvent,
    newLedgerChatSession,
    readAgentEventStream,
    type AiChatItem,
    type AiChatMessage,
    type LedgerChatSession,
    type LedgerPatchProposal,
  } from "../lib/ai/chat";
  import type { InlineAiRequest } from "../studio/workspace";
  import AiUnifiedReviewDiff from "./AiUnifiedReviewDiff.svelte";
  import AiDockSkeleton from "./skeletons/AiDockSkeleton.svelte";

  import { useBeancountController } from "../../controller/context";
  const controller = useBeancountController();
  const request = controller.actions.request;

  type ModelOption = { value: string; label: string };
  type Mention = { path: string };

  const modelOptions: ModelOption[] = [
    { value: "", label: "Codex default" },
    { value: "gpt-5.5", label: "GPT-5.5" },
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "gpt-5.3-codex-spark", label: "Codex Spark" },
  ];

  export let projectId: string | undefined;
  export let projectName = "Ledger";
  export let hasProject = false;
  export let isWeb = false;
  export let inlineRequest: InlineAiRequest | undefined;
  export let onProjectChanged: (() => void | Promise<void>) | undefined;

  export let onClose: (() => void) | undefined;
  let model = "";
  let includeSelection = true;
  let loadingSession = false;
  let streaming = false;
  let sessionError = "";
  let input = "";
  let session: LedgerChatSession = newLedgerChatSession();
  let requestKey = "";
  let loadedProjectId = "";
  let abortController: AbortController | undefined;
  let clearChatConfirmOpen = false;
  let mentionQuery = "";
  let mentionOptions: Mention[] = [];
  let mentionRequest = 0;

  $: selectedModel =
    modelOptions.find((option) => option.value === model) ?? modelOptions[0];
  $: if (inlineRequest) {
    const key = `${inlineRequest.path}:${inlineRequest.fromLine}:${inlineRequest.toLine}:${inlineRequest.text}`;
    if (key !== requestKey) {
      requestKey = key;
      input = inlineRequest.text
        ? `What should I understand about this selection in ${inlineRequest.path}, lines ${inlineRequest.fromLine}-${inlineRequest.toLine}?\n\n${inlineRequest.text}`
        : `What should I understand about ${inlineRequest.path}, lines ${inlineRequest.fromLine}-${inlineRequest.toLine}?`;
    }
  }
  $: if (projectId && projectId !== loadedProjectId && !isWeb) {
    loadedProjectId = projectId;
    void loadSession(projectId);
  }
  $: if (!projectId && loadedProjectId) {
    loadedProjectId = "";
    session = newLedgerChatSession();
  }
  $: updateMentionMenu(input);

  onDestroy(() => {
    abortController?.abort();
    mentionRequest++;
  });

  function api(path = "") {
    if (!projectId) throw new Error("Open a ledger project first.");
    return `/api/projects/${encodeURIComponent(projectId)}/ai${path}`;
  }

  async function responseJson<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        (body as { error?: string }).error ?? response.statusText,
      );
    return body as T;
  }

  async function loadSession(id: string) {
    abortController?.abort();
    streaming = false;
    mentionOptions = [];
    input = "";
    loadingSession = true;
    sessionError = "";
    try {
      const result = await responseJson<{ session: LedgerChatSession }>(
        await request(`/api/projects/${encodeURIComponent(id)}/ai`),
      );
      if (loadedProjectId !== id) return;
      session = result.session;
      model = modelOptions.some((option) => option.value === session.model)
        ? session.model
        : model;
    } catch (error) {
      if (loadedProjectId === id)
        sessionError = error instanceof Error ? error.message : String(error);
    } finally {
      if (loadedProjectId === id) loadingSession = false;
    }
  }

  async function saveModel(nextModel: string) {
    model = nextModel;
    if (!projectId || isWeb || loadingSession) return;
    try {
      const result = await responseJson<{ session: LedgerChatSession }>(
        await request(api(), {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model }),
        }),
      );
      session = result.session;
    } catch (error) {
      sessionError = error instanceof Error ? error.message : String(error);
    }
  }

  function optimisticUserMessage(text: string) {
    const message: AiChatMessage = { role: "user", text };
    const item: AiChatItem = {
      id: `user-${crypto.randomUUID()}`,
      type: "message",
      role: "user",
      text,
    };
    session = {
      ...session,
      messages: [...session.messages, message].slice(-40),
      items: [...session.items, item].slice(-100),
      updatedAt: controller.clock().toISO()!,
    };
  }

  function handleEvent(event: Parameters<typeof applyAgentEvent>[1]) {
    session = applyAgentEvent(session, event);
    if (event.type === "error") streaming = false;
    if (event.type === "done") streaming = false;
  }

  async function send() {
    const prompt = input.trim();
    if (!prompt || streaming || !hasProject) return;
    if (isWeb) {
      sessionError =
        "AI is available when this project is opened through the local Beancount Studio server.";
      return;
    }
    optimisticUserMessage(prompt);
    input = "";
    sessionError = "";
    streaming = true;
    const currentAbort = new AbortController();
    abortController = currentAbort;
    const currentProject = projectId;
    try {
      const response = await request(api(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          model,
          context: includeSelection ? inlineRequest : undefined,
          attachments: mentionedPaths(prompt),
        }),
        signal: currentAbort.signal,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "Unable to start AI chat.");
      }
      await readAgentEventStream(
        response,
        (event) => {
          if (projectId === currentProject) handleEvent(event);
        },
        currentAbort.signal,
      );
    } catch (error) {
      if (!currentAbort.signal.aborted && projectId === currentProject) {
        sessionError = error instanceof Error ? error.message : String(error);
      }
    } finally {
      if (abortController === currentAbort) {
        streaming = false;
        abortController = undefined;
      }
    }
  }

  async function stop() {
    abortController?.abort();
  }

  async function resolveProposal(
    proposal: LedgerPatchProposal,
    action: "keep" | "undo",
  ) {
    try {
      const result = await responseJson<{
        session: LedgerChatSession;
        snapshot?: unknown;
      }>(
        await request(api(`/proposals/${encodeURIComponent(proposal.id)}`), {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        }),
      );
      session = result.session;
      if (action === "keep") await onProjectChanged?.();
    } catch (error) {
      sessionError = error instanceof Error ? error.message : String(error);
    }
  }

  async function clearChat() {
    try {
      const result = await responseJson<{ session: LedgerChatSession }>(
        await request(api(), { method: "DELETE" }),
      );
      session = result.session;
      input = "";
      sessionError = "";
      clearChatConfirmOpen = false;
    } catch (error) {
      sessionError = error instanceof Error ? error.message : String(error);
    }
  }

  async function respondToApproval(
    item: Extract<AiChatItem, { type: "approval" }>,
    decision: "approve" | "reject",
  ) {
    streaming = true;
    const currentAbort = new AbortController();
    abortController = currentAbort;
    const currentProject = projectId;
    try {
      const response = await request(api("/respond"), {
        method: "POST",
        signal: currentAbort.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: item.request.id, decision }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "Unable to respond to the AI request.");
      }
      await readAgentEventStream(
        response,
        (event) => {
          if (projectId === currentProject) handleEvent(event);
        },
        currentAbort.signal,
      );
    } catch (error) {
      if (!currentAbort.signal.aborted && projectId === currentProject)
        sessionError = error instanceof Error ? error.message : String(error);
    } finally {
      if (abortController === currentAbort) {
        streaming = false;
        abortController = undefined;
      }
    }
  }

  function mentionedPaths(text: string) {
    return [...text.matchAll(/(?:^|\s)@([A-Za-z0-9_./-]+)/g)]
      .map((match) => match[1])
      .slice(0, 8);
  }

  function mentionAtEnd(text: string) {
    return /(?:^|\s)@([A-Za-z0-9_./-]*)$/.exec(text)?.[1] ?? "";
  }

  function updateMentionMenu(text: string) {
    const nextQuery = mentionAtEnd(text);
    if (nextQuery === mentionQuery) return;
    mentionQuery = nextQuery;
    if (!nextQuery || !projectId || isWeb) {
      mentionOptions = [];
      return;
    }
    const requestId = ++mentionRequest;
    void request(`${api("/files")}?query=${encodeURIComponent(nextQuery)}`)
      .then((response) => response.json())
      .then((result: { files?: Mention[] }) => {
        if (requestId === mentionRequest) mentionOptions = result.files ?? [];
      })
      .catch(() => {
        if (requestId === mentionRequest) mentionOptions = [];
      });
  }

  function insertMention(path: string) {
    input = input.replace(
      /(?:^|\s)@[A-Za-z0-9_./-]*$/,
      (match) => `${match.startsWith(" ") ? " " : ""}@${path} `,
    );
    mentionOptions = [];
    mentionQuery = "";
  }

  function proposalStatus(proposal: LedgerPatchProposal) {
    return proposal.status ?? "pending";
  }
</script>

<section
  class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
  aria-label="Ledger AI"
>
  <div class="flex h-11 shrink-0 items-center gap-2 border-b px-2">
    <Button
      variant="ghost"
      size="icon"
      aria-label="Collapse AI"
      onclick={() => onClose?.()}
    >
      <ChevronDown />
    </Button>
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <Sparkles class="shrink-0" />
      <p class="min-w-0 truncate text-sm font-medium">AI · {projectName}</p>
      <Select.Root
        type="single"
        value={model}
        onValueChange={(next: string) => void saveModel(next)}
      >
        <Select.Trigger
          class="h-7 min-w-0 max-w-36 border-0 bg-secondary px-2 text-xs shadow-none"
          aria-label={`Select Codex model: ${selectedModel.label}`}
        >
          {selectedModel.label}
        </Select.Trigger>
        <Select.Content aria-label="Codex model options">
          <Select.Group>
            {#each modelOptions as option (option.value)}
              <Select.Item value={option.value}>{option.label}</Select.Item>
            {/each}
          </Select.Group>
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
        class="absolute right-0 top-10 z-40 flex w-60 flex-col gap-2 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md"
      >
        <label class="flex cursor-pointer items-start gap-2">
          <input type="checkbox" bind:checked={includeSelection} />
          <span>Include selected ledger context</span>
        </label>
        <Button
          variant="ghost"
          size="sm"
          class="w-full justify-start"
          onclick={() => (clearChatConfirmOpen = true)}
        >
          <X data-icon="inline-start" />
          Clear this chat
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="w-full justify-start"
          onclick={() => onClose?.()}
        >
          <EyeOff data-icon="inline-start" />
          Hide AI panel
        </Button>
      </div>
    </details>
  </div>

  <ScrollArea.Root class="min-h-0 flex-1">
    <div class="flex min-h-full flex-col gap-3 p-3">
      {#if loadingSession}
        <AiDockSkeleton />
      {:else if !hasProject}
        <div
          class="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground"
        >
          Open a ledger project to ask about its accounts.
        </div>
      {:else if session.items.length === 0}
        <div
          class="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"
        >
          <Sparkles />
          <p>
            Ask about the ledger, or ask for a proposed change. Sources are read
            through safe Beancount tools; changes require review.
          </p>
        </div>
      {/if}

      {#each session.items as item (item.id)}
        {#if item.type === "message"}
          <article
            class={item.role === "user"
              ? "ml-auto max-w-[88%] rounded-lg bg-primary px-3 py-2 text-primary-foreground"
              : "mr-auto max-w-[88%] rounded-lg bg-muted px-3 py-2 text-foreground"}
          >
            <pre
              class="whitespace-pre-wrap font-sans text-sm leading-5">{item.text}</pre>
          </article>
        {:else if item.type === "trace"}
          <Collapsible.Root
            open={item.state === "streaming"}
            class="mx-auto w-full max-w-[94%] rounded-lg border bg-muted/35 px-3 py-2"
          >
            <Collapsible.Trigger
              class="flex w-full items-center gap-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <Brain />
              <span class="flex-1">{item.title}</span>
              {#if item.state === "streaming"}<LoaderCircle
                  class="animate-spin"
                />{/if}
            </Collapsible.Trigger>
            <Collapsible.Content class="mt-3 flex flex-col gap-3">
              {#each item.steps as step (step.id)}
                <div
                  class="border-l pl-3 text-sm"
                  class:border-destructive={step.state === "error"}
                >
                  <p class="font-medium">{step.title}</p>
                  {#if step.text}<pre
                      class="mt-1 whitespace-pre-wrap font-sans text-xs leading-5 text-muted-foreground">{step.text}</pre>{/if}
                  {#each step.tools ?? [] as tool (tool.id)}
                    <details
                      class="mt-2 rounded-md border bg-background/80 p-2"
                    >
                      <summary
                        class="flex cursor-pointer items-center gap-2 text-xs font-medium"
                        ><Wrench /><span class="flex-1">{tool.name}</span><Badge
                          variant={tool.state === "error"
                            ? "destructive"
                            : "secondary"}>{tool.state}</Badge
                        ></summary
                      >
                      {#if tool.input}<pre
                          class="mt-2 max-h-36 overflow-auto whitespace-pre-wrap border-t pt-2 text-xs">{tool.input}</pre>{/if}
                      {#if tool.output}<pre
                          class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap border-t pt-2 text-xs">{tool.output}</pre>{/if}
                    </details>
                  {/each}
                </div>
              {/each}
            </Collapsible.Content>
          </Collapsible.Root>
        {:else if item.type === "proposal"}
          {@const status = proposalStatus(item.proposal)}
          <article
            class="mx-auto w-full max-w-[94%] rounded-lg border bg-card p-3"
          >
            <div class="flex flex-wrap items-center gap-2">
              <FilePenLine />
              <h3 class="min-w-0 flex-1 text-sm font-semibold">
                {item.proposal.title}
              </h3>
              <Badge
                variant={status === "pending"
                  ? "secondary"
                  : status === "kept"
                    ? "default"
                    : status === "undone"
                      ? "outline"
                      : "destructive"}>{status}</Badge
              >
            </div>
            <p class="mt-2 text-xs text-muted-foreground">
              {item.proposal.file.path} · review {item.proposal.replacements
                .length} replacement{item.proposal.replacements.length === 1
                ? ""
                : "s"} before saving.
            </p>
            {#if item.proposal.errors?.length}
              <p class="mt-2 text-xs text-destructive">
                {item.proposal.errors.join("; ")}
              </p>
            {/if}
            <div class="mt-3 flex flex-col gap-2">
              {#each item.proposal.replacements as replacement, index (`${item.proposal.id}-${index}`)}
                <AiUnifiedReviewDiff
                  before={replacement.oldText}
                  after={replacement.newText}
                />
              {/each}
            </div>
            {#if status === "pending"}
              <div class="mt-3 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => void resolveProposal(item.proposal, "undo")}
                  >Undo proposal</Button
                >
                <Button
                  size="sm"
                  onclick={() => void resolveProposal(item.proposal, "keep")}
                  ><Check data-icon="inline-start" /> Keep change</Button
                >
              </div>
            {/if}
          </article>
        {:else if item.type === "approval"}
          <article
            class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
          >
            <p class="font-medium">
              AI needs approval for {item.request.kind}
            </p>
            {#if item.request.reason}<p class="mt-1 text-muted-foreground">
                {item.request.reason}
              </p>{/if}
            <div class="mt-3 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onclick={() => void respondToApproval(item, "reject")}
                >Reject</Button
              ><Button
                size="sm"
                onclick={() => void respondToApproval(item, "approve")}
                >Approve</Button
              >
            </div>
          </article>
        {:else if item.type === "error"}
          <div
            class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {item.text}
          </div>
        {/if}
      {/each}
      {#if sessionError}<div
          class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {sessionError}
        </div>{/if}
      {#if streaming}<div
          class="flex items-center gap-2 px-2 text-xs text-muted-foreground"
        >
          <LoaderCircle class="animate-spin" /> Thinking
        </div>{/if}
    </div>
  </ScrollArea.Root>

  <form
    class="relative shrink-0 border-t p-3"
    onsubmit={(event) => {
      event.preventDefault();
      void send();
    }}
  >
    {#if mentionOptions.length}
      <div
        class="absolute bottom-[calc(100%+0.25rem)] left-3 right-3 z-40 max-h-44 overflow-auto rounded-md border bg-popover p-1 shadow-lg"
      >
        {#each mentionOptions as option (option.path)}
          <button
            type="button"
            class="flex w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            onclick={() => insertMention(option.path)}>@{option.path}</button
          >
        {/each}
      </div>
    {/if}
    <Textarea
      bind:value={input}
      aria-label="Ask ledger assistant"
      class="min-h-20 resize-y"
      placeholder="Ask about balances, entries, or request a proposed ledger change. Type @ to mention a source."
      disabled={!hasProject || streaming}
      onkeydown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          void send();
        }
      }}
    />
    <div class="mt-2 flex items-center justify-between gap-2">
      <span class="text-xs text-muted-foreground">⌘/Ctrl + Enter to send</span>
      {#if streaming}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onclick={() => void stop()}
          ><X data-icon="inline-start" /> Stop</Button
        >
      {:else}
        <Button type="submit" size="sm" disabled={!input.trim() || !hasProject}
          ><Send data-icon="inline-start" /> Ask AI</Button
        >
      {/if}
    </div>
  </form>
</section>

<AlertDialog.Root bind:open={clearChatConfirmOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Clear ledger AI chat?</AlertDialog.Title>
      <AlertDialog.Description
        >This removes the saved conversation and any pending review cards for
        this project. Ledger files will not be changed.</AlertDialog.Description
      >
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={() => void clearChat()}
        >Clear chat</AlertDialog.Action
      >
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
