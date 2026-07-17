<script lang="ts">
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import { Button } from "$lib/components/ui/button";

  type Candidate = {
    id: string;
    kind: "overlap" | "existing" | "transfer";
    confidence: "high" | "possible";
    evidence: { kind: string; summary: string }[];
    recommendedCanonicalId?: string;
  };

  type Member = {
    observation: {
      id: string;
      origin: "proposal" | "ledger";
      sourceAccount: string;
      bookedAt: string;
      amount: string;
      currency: string;
      merchant?: string;
      payee?: string;
      narration?: string;
      sourceId?: string;
    };
  };

  type Item = {
    candidate: Candidate;
    members: Member[];
    decision?: {
      state: "confirmed" | "dismissed";
      canonicalObservationId?: string;
    };
  };

  type Review = { candidates: Item[] };

  let {
    projectId,
    refreshKey = "",
    onApplied = () => {},
  }: {
    projectId?: string;
    /** Changes after sync, edits, and ordinary acceptance to reload candidates. */
    refreshKey?: string;
    onApplied?: () => void;
  } = $props();

  let review = $state<Review | undefined>(undefined);
  let error = $state("");
  let busyCandidateId = $state("");
  let loadedKey = $state("");

  function memberLabel(member: Member) {
    const observation = member.observation;
    return (
      observation.merchant ??
      observation.payee ??
      observation.narration ??
      observation.sourceAccount
    );
  }

  function kindLabel(kind: Candidate["kind"]) {
    if (kind === "overlap") return "Same-account overlap";
    if (kind === "existing") return "Already in ledger";
    return "Account transfer";
  }

  async function load() {
    if (!projectId) {
      review = undefined;
      return;
    }
    try {
      review = await ingestionJson<Review>(
        ingestionPath(projectId, "/reconciliation"),
      );
      error = "";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  async function decide(
    item: Item,
    state: "confirmed" | "dismissed",
    canonicalObservationId?: string,
  ) {
    if (!projectId || busyCandidateId) return;
    busyCandidateId = item.candidate.id;
    try {
      review = await ingestionJson<Review>(
        ingestionPath(projectId, "/reconciliation"),
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            candidateId: item.candidate.id,
            state,
            canonicalObservationId,
          }),
        },
      );
      error = "";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      busyCandidateId = "";
    }
  }

  async function apply(item: Item) {
    if (!projectId || busyCandidateId) return;
    busyCandidateId = item.candidate.id;
    try {
      await ingestionJson(
        ingestionPath(
          projectId,
          `/reconciliation/${encodeURIComponent(item.candidate.id)}/apply`,
        ),
        { method: "POST" },
      );
      await load();
      onApplied();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      busyCandidateId = "";
    }
  }

  $effect(() => {
    const key = `${projectId ?? ""}\0${refreshKey}`;
    if (key === loadedKey) return;
    loadedKey = key;
    void load();
  });
</script>

{#if review?.candidates.length}
  <section class="rounded-xl border bg-card p-4" data-ingestion-reconciliation>
    <div class="mb-3 flex items-baseline justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold">Reconcile matches</h2>
        <p class="text-sm text-muted-foreground">
          Confirm a match before it changes the ledger.
        </p>
      </div>
      <span
        class="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums"
      >
        {review.candidates.length}
      </span>
    </div>

    <div class="grid gap-3">
      {#each review.candidates as item (item.candidate.id)}
        {@const busy = busyCandidateId === item.candidate.id}
        {@const chosen =
          item.decision?.canonicalObservationId ??
          item.candidate.recommendedCanonicalId}
        <article class="rounded-lg border bg-muted/30 p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold">
                {kindLabel(item.candidate.kind)}
              </span>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium {item
                  .candidate.confidence === 'high'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}"
                >{item.candidate.confidence}</span
              >
            </div>
            <span class="text-xs text-muted-foreground">
              {item.candidate.evidence
                .map((evidence) => evidence.summary)
                .join(" · ")}
            </span>
          </div>

          <div class="mt-3 grid gap-2">
            {#each item.members as member (member.observation.id)}
              <div
                class="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm"
              >
                <div class="min-w-0">
                  <div class="truncate font-medium">{memberLabel(member)}</div>
                  <div class="truncate text-xs text-muted-foreground">
                    {member.observation.origin === "ledger"
                      ? "Existing ledger"
                      : (member.observation.sourceId ?? "Incoming source")}
                    · {member.observation.sourceAccount} · {member.observation
                      .bookedAt}
                  </div>
                </div>
                <span class="font-semibold tabular-nums">
                  {member.observation.amount}
                  {member.observation.currency}
                </span>
              </div>
            {/each}
          </div>

          <div class="mt-3 flex flex-wrap items-center justify-end gap-2">
            {#if item.decision?.state === "confirmed"}
              <span class="mr-auto text-xs text-muted-foreground">
                Confirmed; ready to apply.
              </span>
              <Button size="sm" disabled={busy} onclick={() => void apply(item)}
                >Apply safely</Button
              >
            {:else}
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onclick={() => void decide(item, "dismissed")}
                >Not a match</Button
              >
              {#if chosen}
                <Button
                  size="sm"
                  disabled={busy}
                  onclick={() => void decide(item, "confirmed", chosen)}
                  >Confirm match</Button
                >
              {:else}
                {#each item.members as member (member.observation.id)}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onclick={() =>
                      void decide(item, "confirmed", member.observation.id)}
                    >Use {member.observation.origin}</Button
                  >
                {/each}
              {/if}
            {/if}
          </div>
        </article>
      {/each}
    </div>
  </section>
{:else if error}
  <p class="text-sm text-destructive" role="status">{error}</p>
{/if}
