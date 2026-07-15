import { json } from "@sveltejs/kit";
import { loadProjectSources } from "@beancount-js/beancount";
import {
  BrandfetchProvider,
  merchantLogoUrlFor,
  recategorizeProposal,
  type IngestionSourceDefinition,
} from "@beancount-js/server";
import {
  normalizeMerchant,
  type MerchantCandidate,
  type MerchantIdentity,
} from "@beancount-js/beangulp";
import { serverIngestion } from "$lib/server/ingestion";
import { serverWorkspace } from "$lib/server/workspace";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function rawLabel(proposal: {
  transaction?: { merchant?: string; payee?: string; narration: string };
}) {
  return (
    proposal.transaction?.merchant ??
    proposal.transaction?.payee ??
    proposal.transaction?.narration
  );
}

function manualCandidate(
  canonicalName: string,
  details: Record<string, unknown>,
): MerchantCandidate {
  const domain = text(details.domain)?.toLowerCase();
  if (
    domain &&
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)
  )
    throw new Error("Merchant domain must be a valid domain name.");
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

async function cacheLogoIfConfigured(
  projectId: string,
  merchant: MerchantIdentity,
  candidate: MerchantCandidate,
  source: IngestionSourceDefinition,
) {
  const brandfetch = source.merchantEnrichment?.brandfetch;
  if (
    brandfetch?.enabled !== true ||
    brandfetch.assetMode !== "cache" ||
    !brandfetch.cacheContentAllowed ||
    !candidate.logoUrl ||
    !brandfetch.apiKeySecretRef.startsWith("env:")
  ) {
    return merchant;
  }
  const apiKey = process.env[brandfetch.apiKeySecretRef.slice(4)];
  if (!apiKey) return merchant;
  try {
    const asset = await new BrandfetchProvider({
      apiKey,
      clientId: brandfetch.clientId,
      ttlDays: brandfetch.ttlDays,
    }).downloadLogo(candidate.logoUrl);
    return await serverIngestion().merchants.cacheLogo(
      projectId,
      merchant.merchantId,
      asset,
    );
  } catch {
    return merchant;
  }
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
    const source = await store.source(params.id, run.sourceId);
    const proposal = await store.proposal(
      params.id,
      params.runId,
      params.proposalId,
    );
    if (
      !proposal.transaction ||
      proposal.status === "duplicate" ||
      proposal.status === "invalid"
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

    let merchantResolution = proposal.merchantResolution;
    if (action === "confirm" || action === "correct") {
      const candidate =
        action === "confirm"
          ? proposal.merchantResolution?.status === "suggested"
            ? proposal.merchantResolution.candidates.find(
                (item) => item.id === text(body.candidateId),
              )
            : undefined
          : text(body.canonicalName)
            ? manualCandidate(text(body.canonicalName)!, body)
            : undefined;
      if (!candidate)
        return json(
          { error: "Choose a merchant suggestion or provide a merchant name." },
          { status: 400 },
        );
      let merchant = await store.merchants.confirm(params.id, {
        sourceId: source.id,
        rawLabel: label,
        candidate,
        targetMerchantId: text(body.targetMerchantId),
        overwriteDetails: action === "correct",
      });
      merchant = await cacheLogoIfConfigured(
        params.id,
        merchant,
        candidate,
        source,
      );
      merchantResolution = {
        status: "confirmed",
        rawLabel: label,
        merchant: {
          ...merchant,
          logoUrl: merchantLogoUrlFor(
            params.id,
            merchant,
            source.merchantEnrichment ?? { enabled: false },
          ),
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

    const workspace = await serverWorkspace();
    const snapshot = await workspace.readProject(params.id);
    const [entries] = loadProjectSources(
      snapshot.project.entryFile,
      snapshot.ledgerFiles.map((file) => ({
        path: file.path,
        contents: file.contents,
      })),
    );
    const updated = await recategorizeProposal(
      source,
      { ...proposal, merchantResolution },
      entries,
    );
    return json(await store.replaceProposal(params.id, params.runId, updated));
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
