<svelte:options runes={false} />

<script lang="ts">
  import { onMount } from "svelte";
  import AiDock from "@beancount-js/ui/feedback/AiDock.svelte";
  import {
    applyAgentEvent,
    newLedgerChatSession,
    readAgentEventStream,
    type AiChatItem,
    type AiChatMessage,
    type LedgerChatSession,
    type LedgerPatchProposal,
  } from "$lib/ai/chat";
  import type { InlineAiRequest } from "../studio/workspace";

  const MODEL_OPTIONS = [
    { value: "", label: "Codex default" },
    { value: "gpt-5.5", label: "GPT-5.5" },
    { value: "gpt-5.4", label: "GPT-5.4" },
    { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    { value: "gpt-5.3-codex-spark", label: "Codex Spark" },
  ];

  type Mention = { path: string };

  const MODEL_STORAGE_KEY = "beancount-studio:ai-model";
  const CONTEXT_STORAGE_KEY = "beancount-studio:ai-include-selection";
  const VISIBILITY_STORAGE_KEY = "beancount-studio:ai-visibility";

  export let projectId: string | undefined;
  export let projectName = "Ledger";
  export let hasProject = false;
  export let isWeb = false;
  export let inlineRequest: InlineAiRequest | undefined;
  export let onProjectChanged: (() => void | Promise<void>) | undefined;

  let visibility: "expanded" | "collapsed" | "hidden" = "hidden";
  let model = "";
  let includeSelection = true;
  let settingsLoaded = false;
  let loadingSession = false;
  let streaming = false;
  let sessionError = "";
  let inlinePrompt = "";
  let inlinePromptKey = "";
  let loadedProjectId = "";
  let session: LedgerChatSession = newLedgerChatSession();
  let abortController: AbortController | undefined;

  $: if (settingsLoaded) {
    localStorage.setItem(MODEL_STORAGE_KEY, model);
    localStorage.setItem(CONTEXT_STORAGE_KEY, String(includeSelection));
    localStorage.setItem(VISIBILITY_STORAGE_KEY, visibility);
  }
  $: if (projectId && projectId !== loadedProjectId && !isWeb) {
    loadedProjectId = projectId;
    void loadSession(projectId);
  }
  $: if (!projectId && loadedProjectId) {
    loadedProjectId = "";
    session = newLedgerChatSession();
  }
  $: if (inlineRequest) {
    const key = `${inlineRequest.path}:${inlineRequest.fromLine}:${inlineRequest.toLine}:${inlineRequest.text}`;
    if (key !== inlinePromptKey) {
      inlinePromptKey = key;
      inlinePrompt = inlineRequest.text
        ? `What should I understand about this selection in ${inlineRequest.path}, lines ${inlineRequest.fromLine}-${inlineRequest.toLine}?\n\n${inlineRequest.text}`
        : `What should I understand about ${inlineRequest.path}, lines ${inlineRequest.fromLine}-${inlineRequest.toLine}?`;
    }
  }

  onMount(() => {
    const storedModel = localStorage.getItem(MODEL_STORAGE_KEY) ?? "";
    const storedVisibility = localStorage.getItem(VISIBILITY_STORAGE_KEY);
    if (MODEL_OPTIONS.some((option) => option.value === storedModel))
      model = storedModel;
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

  function api(path = "") {
    if (!projectId) throw new Error("Open a ledger project first.");
    return `/api/projects/${encodeURIComponent(projectId)}/ai${path}`;
  }

  async function responseJson<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error((body as { error?: string }).error ?? response.statusText);
    return body as T;
  }

  async function loadSession(id: string) {
    loadingSession = true;
    sessionError = "";
    try {
      const result = await responseJson<{ session: LedgerChatSession }>(
        await fetch(`/api/projects/${encodeURIComponent(id)}/ai`),
      );
      if (loadedProjectId !== id) return;
      session = result.session;
      model = MODEL_OPTIONS.some((option) => option.value === session.model)
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
        await fetch(api(), {
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
      updatedAt: new Date().toISOString(),
    };
  }

  function handleEvent(event: Parameters<typeof applyAgentEvent>[1]) {
    session = applyAgentEvent(session, event);
    if (event.type === "error") streaming = false;
    if (event.type === "done") streaming = false;
  }

  async function send(prompt: string) {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || streaming || !hasProject) return;
    if (isWeb) {
      sessionError =
        "AI is available when this project is opened through the local Beancount Studio server.";
      return;
    }
    optimisticUserMessage(trimmedPrompt);
    sessionError = "";
    streaming = true;
    abortController = new AbortController();
    try {
      const response = await fetch(api(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          model,
          context: includeSelection ? inlineRequest : undefined,
          attachments: mentionedPaths(trimmedPrompt),
        }),
        signal: abortController.signal,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "Unable to start AI chat.");
      }
      await readAgentEventStream(response, handleEvent, abortController.signal);
    } catch (error) {
      if (!abortController.signal.aborted) {
        sessionError = error instanceof Error ? error.message : String(error);
      }
    } finally {
      streaming = false;
      abortController = undefined;
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
        await fetch(api(`/proposals/${encodeURIComponent(proposal.id)}`), {
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
        await fetch(api(), { method: "DELETE" }),
      );
      session = result.session;
    } catch (error) {
      sessionError = error instanceof Error ? error.message : String(error);
    }
  }

  async function respondToApproval(
    item: Extract<AiChatItem, { type: "approval" }>,
    decision: "approve" | "reject",
  ) {
    streaming = true;
    try {
      const response = await fetch(api("/respond"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: item.request.id, decision }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "Unable to respond to the AI request.");
      }
      await readAgentEventStream(response, handleEvent);
    } catch (error) {
      sessionError = error instanceof Error ? error.message : String(error);
    } finally {
      streaming = false;
    }
  }

  async function requestMentions(query: string): Promise<Mention[]> {
    if (!query || !projectId || isWeb) return [];
    try {
      const response = await fetch(`${api("/files")}?query=${encodeURIComponent(query)}`);
      const result = await response.json();
      return (result?.files ?? []) as Mention[];
    } catch {
      return [];
    }
  }

  function mentionedPaths(text: string) {
    return [...text.matchAll(/(?:^|\s)@([A-Za-z0-9_./-]+)/g)]
      .map((match) => match[1])
      .slice(0, 8);
  }

  function setVisibility(nextVisibility: "expanded" | "collapsed" | "hidden") {
    visibility = nextVisibility;
  }
</script>

<AiDock
  {projectName}
  {hasProject}
  {isWeb}
  {session}
  {sessionError}
  {loadingSession}
  {streaming}
  {model}
  {includeSelection}
  {inlinePrompt}
  modelOptions={MODEL_OPTIONS}
  visibility={visibility}
  onVisibilityChange={setVisibility}
  onModelChange={saveModel}
  onIncludeSelectionChange={(next: boolean) => {
    includeSelection = next;
  }}
  onRequestMentions={requestMentions}
  onSend={send}
  onStop={stop}
  onResolveProposal={resolveProposal}
  onRespondToApproval={respondToApproval}
  onClearChat={clearChat}
/>
