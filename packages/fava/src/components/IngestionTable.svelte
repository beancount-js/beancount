<script lang="ts">
  import { onMount } from "svelte";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import type {
    IngestionConfigResponse,
    IngestionRun,
    ImportProposal,
  } from "../ingestion/types";
  import type { ProjectSnapshot } from "@beancount-js/workspace";
  import { Button } from "$lib/components/ui/button";

  const { snapshot } = useStudioWorkspace();
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  let config: IngestionConfigResponse | undefined;
  let run: IngestionRun | undefined;
  let sourceId = "";
  let status = "";
  let loading = false;
  let loadedProjectId = "";
  let correctingProposalId = "";
  let correctionName = "";
  let correctionDomain = "";
  let correctionDescription = "";
  let failedLogoIds = new Set<string>();

  $: project = $snapshot;
  $: selectedSource = config?.sources.find((source) => source.id === sourceId);
  $: accepted =
    run?.proposals.filter(
      (proposal) => proposal.status === "ready" && proposal.selectedAccount,
    ) ?? [];

  async function refresh() {
    if (!project || isWeb) return;
    loading = true;
    try {
      config = await ingestionJson<IngestionConfigResponse>(
        ingestionPath(project.project.id),
      );
      sourceId = config.sources.some((source) => source.id === sourceId)
        ? sourceId
        : (config.sources[0]?.id ?? "");
      loadedProjectId = project.project.id;
      status = config.sources.length
        ? "Choose a source and fetch transactions."
        : "Add a JSON API source in Import Editor first.";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function fetchTransactions() {
    if (!project || !sourceId) return;
    loading = true;
    try {
      run = await ingestionJson<IngestionRun>(
        ingestionPath(project.project.id, "/runs"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceId }),
        },
      );
      status = `${run.summary.ready} ready · ${run.summary.needsReview} need review · ${run.summary.duplicates} duplicates`;
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function chooseAccount(proposal: ImportProposal, account: string) {
    if (!project || !run || !account) return;
    try {
      run = await ingestionJson<IngestionRun>(
        ingestionPath(
          project.project.id,
          `/runs/${encodeURIComponent(run.id)}`,
        ),
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ proposalId: proposal.id, account }),
        },
      );
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    }
  }

  function merchantCandidate(proposal: ImportProposal) {
    return proposal.merchantResolution?.status === "suggested"
      ? proposal.merchantResolution.candidates[0]
      : undefined;
  }

  function merchantDetails(proposal: ImportProposal) {
    if (proposal.merchantResolution?.status === "confirmed")
      return proposal.merchantResolution.merchant;
    return merchantCandidate(proposal);
  }

  function selectedSuggestion(proposal: ImportProposal) {
    return proposal.suggestions.find(
      (suggestion) => suggestion.account === proposal.selectedAccount,
    );
  }

  function scoreLabel(score: number | undefined) {
    return score === undefined ? undefined : score.toFixed(2);
  }

  function merchantProvenance(proposal: ImportProposal) {
    const details = merchantDetails(proposal);
    const labels = (details?.provenance ?? []).map((item) =>
      item.provider ? `${item.source}:${item.provider}` : item.source,
    );
    return [...new Set(labels)].join(" · ");
  }

  function merchantInitials(proposal: ImportProposal) {
    const name =
      merchantDetails(proposal)?.canonicalName ??
      proposal.transaction?.merchant ??
      proposal.transaction?.narration ??
      "?";
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  function startCorrection(proposal: ImportProposal) {
    const details = merchantDetails(proposal);
    correctingProposalId = proposal.id;
    correctionName =
      details?.canonicalName ??
      proposal.transaction?.merchant ??
      proposal.transaction?.narration ??
      "";
    correctionDomain = details?.domain ?? "";
    correctionDescription = details?.description ?? "";
  }

  function markLogoFailed(proposalId: string) {
    failedLogoIds = new Set([...failedLogoIds, proposalId]);
  }

  async function updateMerchant(
    proposal: ImportProposal,
    action: "confirm" | "correct" | "reject" | "clear-suppression",
    extra: Record<string, string | undefined> = {},
  ) {
    if (!project || !run) return;
    loading = true;
    try {
      run = await ingestionJson<IngestionRun>(
        ingestionPath(
          project.project.id,
          `/runs/${encodeURIComponent(run.id)}/proposals/${encodeURIComponent(proposal.id)}/merchant`,
        ),
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        },
      );
      correctingProposalId = "";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function accept() {
    if (!project || !run || !accepted.length || !selectedSource) return;
    const destination =
      selectedSource.destinationPath ?? project.project.entryFile;
    const expectedRevision = project.revisions.find(
      (revision) => revision.path === destination,
    )?.revision;
    if (!expectedRevision) {
      status = "The configured destination is not an editable ledger file.";
      return;
    }
    loading = true;
    try {
      const result = await ingestionJson<{
        snapshot: ProjectSnapshot;
        run: IngestionRun;
      }>(
        ingestionPath(
          project.project.id,
          `/runs/${encodeURIComponent(run.id)}/accept`,
        ),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            proposalIds: accepted.map((proposal) => proposal.id),
            expectedRevision,
          }),
        },
      );
      snapshot.set(result.snapshot);
      run = result.run;
      status = `Accepted ${accepted.length} transaction${accepted.length === 1 ? "" : "s"}.`;
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  $: if (project && !isWeb && project.project.id !== loadedProjectId) {
    void refresh();
  }

  onMount(() => void refresh());
</script>

<div class="h-full overflow-auto p-5">
  <div class="mx-auto max-w-6xl space-y-5">
    <div>
      <h1 class="text-xl font-semibold">Ingestion</h1>
      <p class="text-sm text-muted-foreground">
        Fetch, review, then explicitly add transactions to the ledger.
      </p>
    </div>

    {#if isWeb}
      <div
        class="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
      >
        Remote API ingestion is available only when this project is opened
        through the local Beancount Studio server.
      </div>
    {:else if !project}
      <div class="rounded-md border p-4 text-sm text-muted-foreground">
        Open a project to configure ingestion.
      </div>
    {:else}
      <div class="flex flex-wrap items-end gap-3 rounded-md border p-4">
        <label class="grid gap-1 text-sm">
          <span>Source</span>
          <select
            class="min-w-64 rounded border bg-background px-2 py-1"
            bind:value={sourceId}
          >
            {#each config?.sources ?? [] as source}
              <option value={source.id}
                >{source.name}{source.credentialAvailable
                  ? ""
                  : " (credential unavailable)"}</option
              >
            {/each}
          </select>
        </label>
        <button
          class="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          disabled={!sourceId ||
            loading ||
            !selectedSource?.credentialAvailable}
          onclick={fetchTransactions}>Fetch transactions</button
        >
        <a class="rounded border px-3 py-2 text-sm" href="#/import/editor"
          >Edit sources</a
        >
      </div>
    {/if}

    {#if status}<p class="text-sm text-muted-foreground">{status}</p>{/if}

    {#if run}
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-lg font-semibold">Review run</h2>
        <button
          class="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          disabled={!accepted.length || loading}
          onclick={accept}
          >Accept {accepted.length} reviewed transaction{accepted.length === 1
            ? ""
            : "s"}</button
        >
      </div>
      <div class="overflow-x-auto rounded-md border">
        <table class="w-full min-w-[1100px] text-left text-sm">
          <thead
            class="border-b bg-muted/50 text-xs uppercase text-muted-foreground"
          >
            <tr
              ><th class="p-3">Date</th><th class="p-3">Merchant</th><th
                class="p-3">Amount</th
              ><th class="p-3">Category</th><th class="p-3">Why</th><th
                class="p-3">Status</th
              ></tr
            >
          </thead>
          <tbody>
            {#each run.proposals as proposal}
              <tr class="border-b align-top">
                <td class="p-3 font-mono"
                  >{proposal.transaction?.bookedAt ?? "—"}</td
                >
                <td class="min-w-72 p-3">
                  {#if proposal}
                    {@const details = merchantDetails(proposal)}
                    {@const candidate = merchantCandidate(proposal)}
                    {@const merchantStatus =
                      proposal.merchantResolution?.status ?? "unresolved"}
                    <div class="flex gap-3">
                      {#if details?.logoUrl && !failedLogoIds.has(proposal.id)}
                        <img
                          class="size-9 rounded-md border object-contain"
                          src={details.logoUrl}
                          alt={`${details.canonicalName} logo`}
                          onerror={() => markLogoFailed(proposal.id)}
                        />
                      {:else}
                        <div
                          class="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-medium text-muted-foreground"
                          aria-label="Merchant initials"
                        >
                          {merchantInitials(proposal)}
                        </div>
                      {/if}
                      <div class="min-w-0 flex-1">
                        <p class="truncate font-medium">
                          {details?.canonicalName ??
                            proposal.transaction?.merchant ??
                            proposal.transaction?.narration ??
                            "—"}
                        </p>
                        <p class="truncate text-xs text-muted-foreground">
                          Source: {proposal.transaction?.merchant ??
                            proposal.transaction?.narration ??
                            "—"}
                        </p>
                        {#if details?.domain || details?.industry}
                          <p class="truncate text-xs text-muted-foreground">
                            {[details?.domain, details?.industry]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        {/if}
                        {#if details?.description}
                          <p
                            class="mt-1 line-clamp-2 text-xs text-muted-foreground"
                          >
                            {details.description}
                          </p>
                        {/if}
                        {#if merchantProvenance(proposal)}
                          <p class="mt-1 text-xs text-muted-foreground">
                            Provenance: {merchantProvenance(proposal)}
                          </p>
                        {/if}
                        <p class="mt-1 text-xs text-muted-foreground">
                          {merchantStatus}
                          {#if proposal.merchantResolution?.explanation}
                            · {proposal.merchantResolution.explanation}
                          {/if}
                        </p>
                        {#if merchantStatus === "suggested" && candidate}
                          <div class="mt-2 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={loading}
                              onclick={() =>
                                updateMerchant(proposal, "confirm", {
                                  candidateId: candidate.id,
                                })}>Confirm</Button
                            >
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={loading}
                              onclick={() => startCorrection(proposal)}
                              >Correct</Button
                            >
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={loading}
                              onclick={() => updateMerchant(proposal, "reject")}
                              >Dismiss</Button
                            >
                          </div>
                        {:else if merchantStatus === "suppressed"}
                          <div class="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={loading}
                              onclick={() =>
                                updateMerchant(proposal, "clear-suppression")}
                              >Try again</Button
                            >
                          </div>
                        {:else}
                          <div class="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={loading}
                              onclick={() => startCorrection(proposal)}
                              >{merchantStatus === "confirmed"
                                ? "Edit"
                                : "Set merchant"}</Button
                            >
                          </div>
                        {/if}
                        {#if correctingProposalId === proposal.id}
                          <div
                            class="mt-3 flex flex-col gap-2 rounded-md border bg-muted/30 p-2"
                          >
                            <input
                              class="h-8 rounded-md border bg-background px-2 text-xs"
                              aria-label="Merchant name"
                              bind:value={correctionName}
                              placeholder="Merchant name"
                            />
                            <input
                              class="h-8 rounded-md border bg-background px-2 text-xs"
                              aria-label="Merchant domain"
                              bind:value={correctionDomain}
                              placeholder="example.com (optional)"
                            />
                            <input
                              class="h-8 rounded-md border bg-background px-2 text-xs"
                              aria-label="Merchant description"
                              bind:value={correctionDescription}
                              placeholder="Description (optional)"
                            />
                            <div class="flex gap-2">
                              <Button
                                size="sm"
                                disabled={loading || !correctionName.trim()}
                                onclick={() =>
                                  updateMerchant(proposal, "correct", {
                                    canonicalName: correctionName,
                                    domain: correctionDomain || undefined,
                                    description:
                                      correctionDescription || undefined,
                                    targetMerchantId:
                                      proposal.merchantResolution?.status ===
                                      "confirmed"
                                        ? proposal.merchantResolution.merchant
                                            .merchantId
                                        : undefined,
                                  })}>Save merchant</Button
                              >
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={loading}
                                onclick={() => (correctingProposalId = "")}
                                >Cancel</Button
                              >
                            </div>
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}
                </td>
                <td class="p-3 font-mono"
                  >{proposal.transaction
                    ? `${proposal.transaction.amount} ${proposal.transaction.currency}`
                    : "—"}</td
                >
                <td class="p-3">
                  {#if proposal.status === "ready" || proposal.status === "needs-review"}
                    <select
                      class="min-w-56 rounded border bg-background px-2 py-1"
                      value={proposal.selectedAccount ?? ""}
                      onchange={(event) =>
                        chooseAccount(
                          proposal,
                          (event.currentTarget as HTMLSelectElement).value,
                        )}
                    >
                      <option value="">Choose an account</option>
                      {#each selectedSource?.allowedAccounts ?? [] as account}
                        <option value={account}>{account}</option>
                      {/each}
                    </select>
                  {:else}
                    <span class="text-muted-foreground">—</span>
                  {/if}
                </td>
                <td class="max-w-md p-3 text-muted-foreground">
                  {#if proposal}
                    {@const suggestion = selectedSuggestion(proposal)}
                    {#if suggestion}
                      <p>{suggestion.explanation}</p>
                      {#if suggestion.calibratedProbability !== undefined}
                        <p class="mt-1 text-xs">
                          Confidence: {Math.round(
                            suggestion.calibratedProbability * 100,
                          )}%
                        </p>
                      {:else if suggestion.scoreKind || suggestion.rawScore !== undefined}
                        <p class="mt-1 text-xs">
                          Score: {scoreLabel(suggestion.rawScore) ?? "—"}
                          {#if suggestion.scoreKind}
                            ({suggestion.scoreKind})
                          {/if}
                          {#if suggestion.support !== undefined}
                            · support {suggestion.support}
                          {/if}
                        </p>
                      {/if}
                      {#if suggestion.evidence.length}
                        <ul class="mt-1 list-inside list-disc text-xs">
                          {#each suggestion.evidence as evidence}
                            <li>{evidence.summary}</li>
                          {/each}
                        </ul>
                      {/if}
                    {:else}
                      {proposal.issues.join(" ")}
                    {/if}
                  {/if}
                </td>
                <td class="p-3"
                  ><span class="rounded bg-muted px-2 py-1 text-xs"
                    >{proposal.status}</span
                  ></td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
