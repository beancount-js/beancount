import { json } from "@sveltejs/kit";
import {
  applyMerchantResolutionToPendingProposals,
  merchantLogoUrlFor,
  resolveBrandfetchRuntime,
} from "@beancount-js/server";
import {
  normalizeMerchant,
  type MerchantCandidate,
  type MerchantResolution,
} from "@beancount-js/beangulp";
import { serverIngestion } from "$lib/server/ingestion";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function rawLabel(proposal: {
  transaction?: { merchant?: string; payee?: string; narration: string };
  merchantResolution?: { rawLabel?: string };
}) {
  return (
    proposal.merchantResolution?.rawLabel?.trim() ||
    proposal.transaction?.merchant ||
    proposal.transaction?.payee ||
    proposal.transaction?.narration
  );
}

function parseDomain(value: unknown) {
  const domain = text(value)?.toLowerCase();
  if (
    domain &&
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)
  )
    throw new Error("Merchant domain must be a valid domain name.");
  return domain;
}

function manualCandidate(
  canonicalName: string,
  details: Record<string, unknown>,
): MerchantCandidate {
  const domain = parseDomain(details.domain);
  return {
    id: `manual:${normalizeMerchant(canonicalName)}:${domain ?? ""}`,
    canonicalName,
    domain,
    description: text(details.description),
    industry: text(details.industry),
    countryCode: text(details.countryCode)?.toUpperCase(),
    explanation: "Merchant details were provided manually.",
    provenance: [{ source: "manual", observedAt: new Date().toISOString() }],
  };
}

/** Allow Confirm to fill a missing domain without a full Correct flow. */
function withOptionalDomain(
  candidate: MerchantCandidate,
  details: Record<string, unknown>,
): MerchantCandidate {
  const domain = parseDomain(details.domain);
  if (!domain || candidate.domain) return candidate;
  return { ...candidate, domain };
}

function labelsForFanOut(body: Record<string, unknown>, primaryLabel: string) {
  const labels = new Set<string>([normalizeMerchant(primaryLabel)]);
  const extra = body.normalizedLabels;
  if (Array.isArray(extra)) {
    for (const item of extra) {
      if (typeof item === "string" && item.trim()) {
        labels.add(normalizeMerchant(item));
      }
    }
  }
  return labels;
}

export async function PATCH({
  params,
  request,
}: {
  params: { id: string; runId: string; proposalId: string };
  request: Request;
}) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = text(body.action);
    if (
      !action ||
      !["confirm", "correct", "reject", "clear-suppression"].includes(action)
    )
      return json(
        { error: "A valid merchant action is required." },
        { status: 400 },
      );

    const store = serverIngestion();
    const run = await store.run(params.id, params.runId);
    const source = await store.sourceForRunSourceId(params.id, run.sourceId);
    const proposal = await store.proposal(
      params.id,
      params.runId,
      params.proposalId,
    );
    if (
      !proposal.transaction ||
      proposal.status === "duplicate" ||
      proposal.status === "invalid" ||
      proposal.status === "accepted"
    )
      return json(
        { error: "This proposal cannot be updated." },
        { status: 400 },
      );
    const label = rawLabel(proposal);
    if (!label)
      return json(
        { error: "This proposal has no merchant label." },
        { status: 400 },
      );

    let merchantResolution: MerchantResolution;
    if (action === "confirm" || action === "correct") {
      const candidate =
        action === "confirm"
          ? (() => {
              const selected =
                proposal.merchantResolution?.status === "suggested"
                  ? proposal.merchantResolution.candidates.find(
                      (item) => item.id === text(body.candidateId),
                    )
                  : undefined;
              return selected ? withOptionalDomain(selected, body) : undefined;
            })()
          : text(body.canonicalName)
            ? manualCandidate(text(body.canonicalName)!, body)
            : undefined;
      if (!candidate)
        return json(
          { error: "Choose a merchant suggestion or provide a merchant name." },
          { status: 400 },
        );
      const merchant = await store.merchants.confirm(params.id, {
        sourceId: source.id,
        rawLabel: label,
        candidate,
        targetMerchantId: text(body.targetMerchantId),
        overwriteDetails: action === "correct",
      });
      const enrichment = source.merchantEnrichment ?? { enabled: false };
      const brandfetch = (await store.readConfig(params.id)).brandfetch;
      const runtime = brandfetch
        ? await resolveBrandfetchRuntime(
            brandfetch,
            await store.projectRoot(params.id),
          )
        : undefined;
      merchantResolution = {
        status: "confirmed",
        rawLabel: label,
        merchant: {
          ...merchant,
          logoUrl: merchantLogoUrlFor(params.id, merchant, {
            ...enrichment,
            brandfetch: brandfetch
              ? { ...brandfetch, clientId: runtime?.clientId }
              : undefined,
          }),
        },
        explanation: `Confirmed merchant ${merchant.canonicalName}.`,
      };
    } else if (action === "reject") {
      await store.merchants.suppress(params.id, source.id, label);
      merchantResolution = {
        status: "suppressed",
        rawLabel: label,
        explanation: "Merchant enrichment was dismissed for this source label.",
      };
    } else {
      await store.merchants.clearSuppression(params.id, source.id, label);
      merchantResolution = {
        status: "unresolved",
        rawLabel: label,
        explanation: "Merchant enrichment can be requested again.",
      };
    }

    const archivedRuns = await store.readRuns(params.id);
    const fanOut = applyMerchantResolutionToPendingProposals(
      archivedRuns,
      source.id,
      labelsForFanOut(body, label),
      merchantResolution,
      {
        includeSuppressed:
          action === "clear-suppression" ||
          action === "confirm" ||
          action === "correct",
      },
    );
    // Ensure the primary proposal is included even if it was UI-accepted.
    const runs = fanOut.runs.map((item) => {
      if (item.id !== params.runId) return item;
      return {
        ...item,
        proposals: item.proposals.map((entry) =>
          entry.id === params.proposalId
            ? {
                ...entry,
                merchantResolution,
                issues: (entry.issues ?? []).filter(
                  (issue) =>
                    !issue.startsWith("Merchant resolver ") &&
                    !issue.startsWith("AI merchant advisor "),
                ),
              }
            : entry,
        ),
      };
    });
    const written = await store.writeRuns(params.id, runs);
    const updatedRun =
      written.find((item) => item.id === params.runId) ??
      (await store.run(params.id, params.runId));
    return json({
      run: updatedRun,
      updatedCount: fanOut.updatedCount,
    });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
