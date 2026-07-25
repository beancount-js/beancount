<script lang="ts">
  import Brain from "lucide-svelte/icons/brain";
  import Check from "lucide-svelte/icons/check";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import EyeOff from "lucide-svelte/icons/eye-off";
  import FilePenLine from "lucide-svelte/icons/file-pen-line";
  import LoaderCircle from "lucide-svelte/icons/loader-circle";
  import Send from "lucide-svelte/icons/send";
  import SlidersHorizontal from "lucide-svelte/icons/sliders-horizontal";
  import Sparkles from "lucide-svelte/icons/sparkles";
  import Wrench from "lucide-svelte/icons/wrench";
  import X from "lucide-svelte/icons/x";
  import { Badge } from "../shadcn/badge";
  import { Button } from "../shadcn/button";
  import * as AlertDialog from "../shadcn/alert-dialog";
  import * as Collapsible from "../shadcn/collapsible";
  import * as ScrollArea from "../shadcn/scroll-area";
  import * as Select from "../shadcn/select";
  import { Textarea } from "../shadcn/textarea";
  import AiDockSkeleton from "./AiDockSkeleton.svelte";
  import AiUnifiedReviewDiff from "./AiUnifiedReviewDiff.svelte";

  type ModelOption = { value: string; label: string };
  type LedgerProposalStatus =
    | "pending"
    | "kept"
    | "undone"
    | "stale"
    | "invalid";
  type LedgerPatchProposal = {
    id: string;
    kind: "ledger";
    title: string;
    file: { path: string; revision: string };
    replacements: { oldText: string; newText: string }[];
    valid: boolean;
    errors?: string[];
    status?: LedgerProposalStatus;
  };
  type AiChatMessage = { role: "user" | "assistant"; text: string };
  type AiChatItem =
    | { id: string; type: "message"; role: "user" | "assistant"; text: string }
    | {
        id: string;
        type: "trace";
        title: string;
        state: "streaming" | "done";
        steps: Array<{
          id: string;
          title: string;
          text?: string;
          state: "active" | "complete" | "error";
          tools?: Array<{
            id: string;
            toolId: string;
            name: string;
            state: "running" | "completed" | "error";
            input?: string;
            output?: string;
          }>;
        }>;
      }
    | { id: string; type: "proposal"; proposal: LedgerPatchProposal }
    | {
        id: string;
        type: "approval";
        request: { id: string | number; kind: string; reason?: string | null };
      }
    | { id: string; type: "error"; text: string };
  type LedgerChatSession = {
    version: 1;
    provider: "codex";
    model: string;
    title: string;
    messages: AiChatMessage[];
    items: AiChatItem[];
    updatedAt: string;
  };
  type Mention = { path: string };
  type AiDockVisibility = "expanded" | "collapsed" | "hidden";
  type AiDockProposalAction = "keep" | "undo";
  type AiDockApprovalDecision = "approve" | "reject";

  const DEFAULT_MODEL_OPTIONS: ModelOption[] = [
    { value: "", label: "Codex default" },
    { value: "gpt-5.5", label: "GPT-5.5" },
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "gpt-5.3-codex-spark", label: "Codex Spark" },
  ];
  const EMPTY_SESSION: LedgerChatSession = {
    version: 1,
    provider: "codex",
    model: "",
    title: "Ledger assistant",
    messages: [],
    items: [],
    updatedAt: new Date().toISOString(),
  };

  let {
    projectName = "Ledger",
    hasProject = false,
    isWeb = false,
    visibility = "hidden" as AiDockVisibility,
    onVisibilityChange = () => {},
    model = "",
    modelOptions = DEFAULT_MODEL_OPTIONS,
    includeSelection = true,
    onIncludeSelectionChange = () => {},
    loadingSession = false,
    streaming = false,
    session = EMPTY_SESSION,
    sessionError = "",
    inlinePrompt = "",
    onSend = async () => {},
    onStop = () => {},
    onResolveProposal = () => {},
    onRespondToApproval = () => {},
    onClearChat = () => {},
    onModelChange = () => {},
    onRequestMentions = async () => [],
  }: {
    projectName?: string;
    hasProject?: boolean;
    isWeb?: boolean;
    visibility?: AiDockVisibility;
    onVisibilityChange?: (next: AiDockVisibility) => void;
    model?: string;
    modelOptions?: readonly ModelOption[];
    includeSelection?: boolean;
    onIncludeSelectionChange?: (next: boolean) => void;
    loadingSession?: boolean;
    streaming?: boolean;
    session: LedgerChatSession;
    sessionError?: string;
    inlinePrompt?: string;
    onSend?: (prompt: string) => Promise<void> | void;
    onStop?: () => Promise<void> | void;
    onResolveProposal?: (
      proposal: LedgerPatchProposal,
      action: AiDockProposalAction,
    ) => Promise<void> | void;
    onRespondToApproval?: (
      item: Extract<AiChatItem, { type: "approval" }>,
      decision: AiDockApprovalDecision,
    ) => Promise<void> | void;
    onClearChat?: () => Promise<void> | void;
    onModelChange?: (nextModel: string) => Promise<void> | void;
    onRequestMentions?: (query: string) => Promise<Mention[]> | Mention[];
  } = $props();

  const selectedModel = $derived.by(() =>
    modelOptions.find((option) => option.value === model) ??
    modelOptions[0] ??
    DEFAULT_MODEL_OPTIONS[0],
  );

  let clearChatConfirmOpen = $state(false);
  let input = $state("");
  let mentionQuery = $state("");
  let mentionOptions = $state<Mention[]>([]);
  let mentionRequest = $state(0);
  let requestSignature = $state("");

  $effect(() => {
    if (!inlinePrompt || inlinePrompt === requestSignature) return;
    requestSignature = inlinePrompt;
    input = inlinePrompt;
    onVisibilityChange("expanded");
  });

  $effect(() => {
    if (!hasProject || isWeb) {
      mentionOptions = [];
      return;
    }
    updateMentionMenu(input);
  });

  function updateMentionMenu(text: string) {
    const nextQuery = mentionAtEnd(text);
    if (nextQuery === mentionQuery) return;
    mentionQuery = nextQuery;
    if (!nextQuery) {
      mentionOptions = [];
      return;
    }
    const nextRequest = ++mentionRequest;
    void Promise.resolve(onRequestMentions(nextQuery))
      .then((result) => {
        if (nextRequest === mentionRequest) {
          mentionOptions = result ?? [];
        }
      })
      .catch(() => {
        if (nextRequest === mentionRequest) {
          mentionOptions = [];
        }
      });
  }

  function mentionAtEnd(text: string) {
    return /(?:^|\s)@([A-Za-z0-9_./-]*)$/.exec(text)?.[1] ?? "";
  }

  function insertMention(path: string) {
    input = input.replace(
      /(?:^|\s)@[A-Za-z0-9_./-]*$/,
      (match) => `${match.startsWith(" ") ? " " : ""}@${path} `,
    );
    mentionOptions = [];
    mentionQuery = "";
    mentionRequest = 0;
  }

  function proposalStatus(proposal: LedgerPatchProposal) {
    return proposal.status ?? "pending";
  }

  function setIncludeSelectionValue(event: Event) {
    onIncludeSelectionChange((event.currentTarget as HTMLInputElement).checked);
  }

  function setModel(nextModel: string) {
    onModelChange(nextModel);
  }

  async function send() {
    const prompt = input.trim();
    if (!prompt || streaming || !hasProject) return;
    input = "";
    mentionOptions = [];
    mentionQuery = "";
    await onSend(prompt);
  }

  async function clearChat() {
    await onClearChat();
    clearChatConfirmOpen = false;
  }
</script>

{#if visibility !== "expanded"}
  <div class="fixed bottom-4 right-4 z-30">
    <Button
      variant="outline"
      size="icon"
      class="rounded-full bg-background shadow-lg"
      aria-label="Open ledger AI"
      title="Ask about this ledger"
      onclick={() => onVisibilityChange("expanded")}
    >
      <Sparkles />
    </Button>
  </div>
{:else}
  <section
    class="fixed bottom-4 left-4 right-4 z-30 mx-auto flex h-[min(72vh,620px)] max-w-3xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl lg:static lg:z-auto lg:h-full lg:w-[26rem] lg:max-w-none lg:shrink-0"
    aria-label="Ledger AI"
  >
    <div class="flex h-11 shrink-0 items-center gap-2 border-b px-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Collapse AI"
        onclick={() => onVisibilityChange("collapsed")}
      >
        <ChevronDown />
      </Button>
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <Sparkles class="shrink-0" />
        <p class="min-w-0 truncate text-sm font-medium">AI · {projectName}</p>
        <Select.Root
          type="single"
          value={model}
          onValueChange={(next: string) => setModel(next)}
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
          class="absolute right-0 top-10 z-40 flex w-60 flex-col gap-2 rounded-md border bg-popover p-3 text-sm text-popover-foreground shadow-md"
        >
          <label class="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={includeSelection}
              onchange={setIncludeSelectionValue}
            />
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
            onclick={() => onVisibilityChange("hidden")}
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
                          ><Wrench /><span class="flex-1">{tool.name}</span
                          ><Badge
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
                    onclick={() => void onResolveProposal(item.proposal, "undo")}
                    >Undo proposal</Button
                  >
                  <Button
                    size="sm"
                    onclick={() => void onResolveProposal(item.proposal, "keep")}
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
                  variant="ghost"
                  size="sm"
                  onclick={() =>
                    void onRespondToApproval(item, "reject")}
                  >Reject</Button
                ><Button
                  size="sm"
                  onclick={() =>
                    void onRespondToApproval(item, "approve")}
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
        <span class="text-xs text-muted-foreground">⌘/Ctrl + Enter to send</span
        >
        {#if streaming}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onclick={() => void onStop()}
            ><X data-icon="inline-start" /> Stop</Button
          >
        {:else}
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || !hasProject}
            ><Send data-icon="inline-start" /> Ask AI</Button
          >
        {/if}
      </div>
    </form>
  </section>
{/if}

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
