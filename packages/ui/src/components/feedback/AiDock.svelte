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

  const selectedModel = $derived.by(
    () =>
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
  <div class="cn-feedback-aidock-245-1">
    <Button
      variant="outline"
      size="icon"
      class="cn-feedback-aidock-249-1"
      aria-label="Open ledger AI"
      title="Ask about this ledger"
      onclick={() => onVisibilityChange("expanded")}
    >
      <Sparkles />
    </Button>
  </div>
{:else}
  <section class="cn-feedback-aidock-259-1" aria-label="Ledger AI">
    <div class="cn-feedback-aidock-262-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Collapse AI"
        onclick={() => onVisibilityChange("collapsed")}
      >
        <ChevronDown />
      </Button>
      <div class="cn-feedback-aidock-271-1">
        <Sparkles class="cn-feedback-aidock-272-1" />
        <p class="cn-feedback-aidock-273-1">AI · {projectName}</p>
        <Select.Root
          type="single"
          value={model}
          onValueChange={(next: string) => setModel(next)}
        >
          <Select.Trigger
            class="cn-feedback-aidock-280-1"
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
      <details class="cn-feedback-aidock-292-1">
        <summary
          class="cn-feedback-aidock-294-1"
          aria-label="AI settings"
          title="AI settings"
        >
          <SlidersHorizontal />
        </summary>
        <div class="cn-feedback-aidock-301-1">
          <label class="cn-feedback-aidock-303-1">
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
            class="cn-feedback-aidock-314-1"
            onclick={() => (clearChatConfirmOpen = true)}
          >
            <X data-icon="inline-start" />
            Clear this chat
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="cn-feedback-aidock-323-1"
            onclick={() => onVisibilityChange("hidden")}
          >
            <EyeOff data-icon="inline-start" />
            Hide AI panel
          </Button>
        </div>
      </details>
    </div>

    <ScrollArea.Root class="cn-feedback-aidock-333-1">
      <div class="cn-feedback-aidock-334-1">
        {#if loadingSession}
          <AiDockSkeleton />
        {:else if !hasProject}
          <div class="cn-feedback-aidock-339-1">
            Open a ledger project to ask about its accounts.
          </div>
        {:else if session.items.length === 0}
          <div class="cn-feedback-aidock-345-1">
            <Sparkles />
            <p>
              Ask about the ledger, or ask for a proposed change. Sources are
              read through safe Beancount tools; changes require review.
            </p>
          </div>
        {/if}

        {#each session.items as item (item.id)}
          {#if item.type === "message"}
            <article
              class={item.role === "user"
                ? "cn-feedback-aidock-359-1"
                : "cn-feedback-aidock-360-1"}
            >
              <pre class="cn-feedback-aidock-363-1">{item.text}</pre>
            </article>
          {:else if item.type === "trace"}
            <Collapsible.Root
              open={item.state === "streaming"}
              class="cn-feedback-aidock-368-1"
            >
              <Collapsible.Trigger class="cn-feedback-aidock-371-1">
                <Brain />
                <span class="cn-feedback-aidock-374-1">{item.title}</span>
                {#if item.state === "streaming"}<LoaderCircle
                    class="cn-feedback-aidock-376-1"
                  />{/if}
              </Collapsible.Trigger>
              <Collapsible.Content class="cn-feedback-aidock-379-1">
                {#each item.steps as step (step.id)}
                  <div
                    class="cn-feedback-aidock-382-1"
                    class:cn-feedback-aidock-383-1={step.state === "error"}
                  >
                    <p class="cn-feedback-aidock-385-1">{step.title}</p>
                    {#if step.text}<pre
                        class="cn-feedback-aidock-387-1">{step.text}</pre>{/if}
                    {#each step.tools ?? [] as tool (tool.id)}
                      <details class="cn-feedback-aidock-390-1">
                        <summary class="cn-feedback-aidock-393-1"
                          ><Wrench /><span class="cn-feedback-aidock-394-1"
                            >{tool.name}</span
                          ><Badge
                            variant={tool.state === "error"
                              ? "destructive"
                              : "secondary"}>{tool.state}</Badge
                          ></summary
                        >
                        {#if tool.input}<pre
                            class="cn-feedback-aidock-402-1">{tool.input}</pre>{/if}
                        {#if tool.output}<pre
                            class="cn-feedback-aidock-404-1">{tool.output}</pre>{/if}
                      </details>
                    {/each}
                  </div>
                {/each}
              </Collapsible.Content>
            </Collapsible.Root>
          {:else if item.type === "proposal"}
            {@const status = proposalStatus(item.proposal)}
            <article class="cn-feedback-aidock-414-1">
              <div class="cn-feedback-aidock-416-1">
                <FilePenLine />
                <h3 class="cn-feedback-aidock-418-1">
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
              <p class="cn-feedback-aidock-431-1">
                {item.proposal.file.path} · review {item.proposal.replacements
                  .length} replacement{item.proposal.replacements.length === 1
                  ? ""
                  : "s"} before saving.
              </p>
              {#if item.proposal.errors?.length}
                <p class="cn-feedback-aidock-438-1">
                  {item.proposal.errors.join("; ")}
                </p>
              {/if}
              <div class="cn-feedback-aidock-442-1">
                {#each item.proposal.replacements as replacement, index (`${item.proposal.id}-${index}`)}
                  <AiUnifiedReviewDiff
                    before={replacement.oldText}
                    after={replacement.newText}
                  />
                {/each}
              </div>
              {#if status === "pending"}
                <div class="cn-feedback-aidock-451-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={() =>
                      void onResolveProposal(item.proposal, "undo")}
                    >Undo proposal</Button
                  >
                  <Button
                    size="sm"
                    onclick={() =>
                      void onResolveProposal(item.proposal, "keep")}
                    ><Check data-icon="inline-start" /> Keep change</Button
                  >
                </div>
              {/if}
            </article>
          {:else if item.type === "approval"}
            <article class="cn-feedback-aidock-468-1">
              <p class="cn-feedback-aidock-470-1">
                AI needs approval for {item.request.kind}
              </p>
              {#if item.request.reason}<p class="cn-feedback-aidock-473-1">
                  {item.request.reason}
                </p>{/if}
              <div class="cn-feedback-aidock-476-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onclick={() => void onRespondToApproval(item, "reject")}
                  >Reject</Button
                ><Button
                  size="sm"
                  onclick={() => void onRespondToApproval(item, "approve")}
                  >Approve</Button
                >
              </div>
            </article>
          {:else if item.type === "error"}
            <div class="cn-feedback-aidock-493-1">
              {item.text}
            </div>
          {/if}
        {/each}
        {#if sessionError}<div class="cn-feedback-aidock-500-1">
            {sessionError}
          </div>{/if}
        {#if streaming}<div class="cn-feedback-aidock-505-1">
            <LoaderCircle class="cn-feedback-aidock-507-1" /> Thinking
          </div>{/if}
      </div>
    </ScrollArea.Root>

    <form
      class="cn-feedback-aidock-513-1"
      onsubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      {#if mentionOptions.length}
        <div class="cn-feedback-aidock-521-1">
          {#each mentionOptions as option (option.path)}
            <button
              type="button"
              class="cn-feedback-aidock-526-1"
              onclick={() => insertMention(option.path)}>@{option.path}</button
            >
          {/each}
        </div>
      {/if}
      <Textarea
        bind:value={input}
        class="cn-feedback-aidock-534-1"
        placeholder="Ask about balances, entries, or request a proposed ledger change. Type @ to mention a source."
        disabled={!hasProject || streaming}
        onkeydown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void send();
          }
        }}
      />
      <div class="cn-feedback-aidock-544-1">
        <span class="cn-feedback-aidock-545-1">⌘/Ctrl + Enter to send</span>
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
