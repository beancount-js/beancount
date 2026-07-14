<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import {
    StructuredForm,
    createFormConfig,
    readonlyField,
  } from "@beancount-js/forms";
  import { BrowserWorkspaceAdapter } from "@beancount-js/web";
  import type {
    ProjectConfig,
    ProjectSnapshot,
    ProjectSummary,
  } from "@beancount-js/workspace";

  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  const projectForm = createFormConfig<ProjectConfig>({
    id: "project-details",
    fields: [
      readonlyField({
        id: "name",
        label: "Project",
        get: (project) => project.name,
      }),
      readonlyField({
        id: "entry",
        label: "Entry file",
        get: (project) => project.entryFile,
      }),
    ],
  });

  let webWorkspace: BrowserWorkspaceAdapter | undefined;
  let projects = $state<ProjectSummary[]>([]);
  let snapshot = $state<ProjectSnapshot | undefined>();
  let selectedPath = $state<string | undefined>();
  let status = $state("Loading projects…");
  let aiPinned = $state(false);
  let aiQuestion = $state("");
  let aiReply = $state("");
  let dirty = $state(false);

  const selectedFile = $derived(
    snapshot?.files.find((file) => file.path === selectedPath),
  );
  const analysis = $derived.by(() => {
    if (!snapshot) return undefined;
    const ledger = snapshot.files
      .filter((file) => /\.(bean|beancount|ledger)$/i.test(file.path))
      .flatMap((file) => file.contents.split("\n"));
    const accounts = new Set(
      ledger.flatMap((line) =>
        [
          ...line.matchAll(
            /\b(?:Assets|Liabilities|Equity|Income|Expenses):[\w:-]+/g,
          ),
        ].map((match) => match[0]),
      ),
    );
    return {
      entries: ledger.filter((line) => /^\d{4}-\d{2}-\d{2}/.test(line.trim()))
        .length,
      accounts: accounts.size,
      errors: 0,
    };
  });

  async function refreshProjects() {
    projects =
      isWeb && webWorkspace
        ? await webWorkspace.listProjects()
        : await (await fetch("/api/projects")).json();
  }

  async function selectProject(id: string) {
    const loaded: ProjectSnapshot =
      isWeb && webWorkspace
        ? await webWorkspace.readProject(id)
        : await (await fetch(`/api/projects/${id}`)).json();
    snapshot = loaded;
    selectedPath = loaded.project.entryFile;
    dirty = false;
    status = `${loaded.files.length} files loaded`;
  }

  async function openDirectory() {
    if (!webWorkspace || !browser || !("showDirectoryPicker" in window)) return;
    const handle = await (
      window as Window & {
        showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker();
    const project = await webWorkspace.addDirectory(handle);
    await refreshProjects();
    await selectProject(project.id);
  }

  async function saveFile() {
    if (!snapshot || !selectedFile) return;
    status = "Saving…";
    if (isWeb && webWorkspace) {
      await webWorkspace.writeFile(snapshot.project.id, selectedFile);
    } else {
      await fetch(
        `/api/projects/${snapshot.project.id}/files/${selectedFile.path}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: selectedFile.contents }),
        },
      );
    }
    await selectProject(snapshot.project.id);
    await refreshProjects();
  }

  async function openResource() {
    if (!snapshot || !selectedFile) return;
    if (isWeb && webWorkspace) {
      const bytes = await webWorkspace.readResource(
        snapshot.project.id,
        selectedFile.path,
      );
      const body = new Uint8Array(bytes.byteLength);
      body.set(bytes);
      const url = URL.createObjectURL(
        new Blob([body.buffer], { type: selectedFile.mimeType }),
      );
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    window.open(
      `/api/projects/${snapshot.project.id}/resources/${selectedFile.path}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function updateSelectedContents(contents: string) {
    if (!snapshot || !selectedPath) return;
    snapshot = {
      ...snapshot,
      files: snapshot.files.map((file) =>
        file.path === selectedPath ? { ...file, contents } : file,
      ),
    };
    dirty = true;
  }

  async function askAi() {
    if (isWeb) {
      aiReply =
        "AI is intentionally unavailable in the static-web build. Open this project with the CLI-hosted server to ask about account state.";
      return;
    }
    if (!snapshot || !aiQuestion.trim()) return;
    aiReply = "Codex is reading the bounded ledger snapshot…";
    try {
      const response = await fetch(`/api/projects/${snapshot.project.id}/ai`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: aiQuestion }),
      });
      const result = await response.json();
      aiReply =
        result.answer ?? result.error ?? "Codex did not return an answer.";
    } catch (error) {
      aiReply = error instanceof Error ? error.message : String(error);
    }
  }

  async function initializeWorkspace() {
    try {
      if (isWeb) {
        webWorkspace = new BrowserWorkspaceAdapter();
        const project = await webWorkspace.addOpfsProject();
        await refreshProjects();
        await selectProject(project.id);
      } else {
        await refreshProjects();
        if (projects[0]) await selectProject(projects[0].id);
        else
          status =
            "Start with beancount-js <folder>, or open the static web build in a compatible browser.";
      }
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    }
  }

  onMount(() => {
    void initializeWorkspace();
    const timer = window.setInterval(async () => {
      if (isWeb || !snapshot || dirty) return;
      try {
        const next: ProjectSnapshot = await (
          await fetch(`/api/projects/${snapshot.project.id}`)
        ).json();
        if (
          JSON.stringify(next.revisions) !== JSON.stringify(snapshot.revisions)
        ) {
          snapshot = next;
          status = "Reloaded external filesystem changes";
        }
      } catch {
        // The local server may be stopping; a later poll will reconcile it.
      }
    }, 4_000);
    return () => window.clearInterval(timer);
  });
</script>

<main class:ai-pinned={aiPinned}>
  <aside class="project-sidebar">
    <div class="brand"><span>◈</span> Beancount Studio</div>
    <p class="runtime">
      {isWeb ? "Static web workspace" : "Local server workspace"}
    </p>
    {#if isWeb}
      <button class="primary" onclick={openDirectory}>Open local folder</button>
    {/if}
    <nav aria-label="Projects">
      <div class="section-heading">Projects</div>
      {#each projects as project (project.id)}
        <button
          class:active={snapshot?.project.id === project.id}
          onclick={() => selectProject(project.id)}
        >
          <strong>{project.name}</strong><small>{project.entryFile}</small>
        </button>
      {/each}
    </nav>
    <div class="status">{status}</div>
  </aside>

  <section class="workspace-shell">
    <header>
      <div>
        <p class="eyebrow">LEDGER WORKSPACE</p>
        <h1>{snapshot?.project.name ?? "No project selected"}</h1>
      </div>
      <button class="ghost" onclick={() => (aiPinned = !aiPinned)}
        >{aiPinned ? "Unpin AI" : "Pin AI"}</button
      >
    </header>

    {#if snapshot}
      <div class="overview">
        <article>
          <span>Directives</span><strong>{analysis?.entries ?? 0}</strong>
        </article>
        <article>
          <span>Accounts</span><strong>{analysis?.accounts ?? 0}</strong>
        </article>
        <article class:error={analysis?.errors}>
          <span>Ledger issues</span><strong>{analysis?.errors ?? 0}</strong>
        </article>
      </div>
      <div class="content-grid">
        <nav class="file-tree" aria-label="Project files">
          <div class="section-heading">Files & resources</div>
          {#each snapshot.files as file (file.path)}
            <button
              class:active={file.path === selectedPath}
              onclick={() => (selectedPath = file.path)}>{file.path}</button
            >
          {/each}
        </nav>
        <article class="file-viewer">
          {#if selectedFile}
            <div class="file-heading">
              <strong>{selectedFile.path}</strong><span
                >{selectedFile.mimeType}</span
              >
            </div>
            {#if selectedFile.mimeType?.startsWith("image/")}
              <p>Open this local image in a new tab.</p>
              <button class="primary" onclick={openResource}>Open image</button>
            {:else if selectedFile.mimeType === "application/pdf"}
              <p>Open this local PDF in a new tab.</p>
              <button class="primary" onclick={openResource}>Open PDF</button>
            {:else}
              <textarea
                value={selectedFile.contents}
                oninput={(event) =>
                  updateSelectedContents(event.currentTarget.value)}
                aria-label={`Edit ${selectedFile.path}`}
              ></textarea>
              <button class="primary save" onclick={saveFile}>Save file</button>
            {/if}
          {/if}
        </article>
      </div>
    {:else}
      <div class="empty">{status}</div>
    {/if}
  </section>

  <aside class="ai-sidebar" aria-label="AI account assistant">
    <div class="ai-title">
      <span>✦</span>
      <div>
        <strong>Account assistant</strong><small>Read-only Codex context</small>
      </div>
    </div>
    {#if snapshot}
      <StructuredForm
        config={projectForm}
        value={snapshot.project}
        context={undefined}
        readonly
      />
    {/if}
    <label
      >Ask about the state of accounts
      <textarea
        bind:value={aiQuestion}
        placeholder="Which accounts changed this month?"
      ></textarea>
    </label>
    <button class="primary" onclick={askAi}>Ask Codex</button>
    {#if aiReply}<p class="ai-reply">{aiReply}</p>{/if}
  </aside>
</main>
