import { json } from "@sveltejs/kit";
import {
  BrandfetchProvider,
  createBrandfetchResponseCache,
  merchantLogoUrlFor,
  resolveBrandfetchRuntime,
} from "@beancount-js/server";
import type { MerchantCandidate } from "@beancount-js/beangulp";
import { serverIngestion } from "$lib/server/ingestion";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function POST({
  params,
  request,
}: {
  params: { id: string; merchantId: string };
  request: Request;
}) {
  try {
    const body = (await request.json()) as { sourceId?: unknown };
    if (typeof body.sourceId !== "string")
      return json({ error: "sourceId is required." }, { status: 400 });
    const store = serverIngestion();
    const source = await store.sourceForRunSourceId(params.id, body.sourceId);
    const brandfetch = source.merchantEnrichment?.brandfetch;
    if (
      !source.merchantEnrichment?.enabled ||
      !brandfetch?.enabled ||
      !brandfetch.apiKeySecretRef.trim()
    ) {
      return json(
        { error: "Brandfetch enrichment is not enabled." },
        { status: 400 },
      );
    }
    const projectRoot = await store.projectRoot(params.id);
    const runtime = await resolveBrandfetchRuntime(brandfetch, projectRoot);
    if (!runtime?.apiKey)
      return json(
        { error: "Brandfetch credential is unavailable." },
        { status: 400 },
      );
    const merchant = await store.merchants.get(params.id, params.merchantId);
    if (!merchant.domain)
      return json(
        { error: "This merchant has no confirmed domain." },
        { status: 400 },
      );
    const candidate: MerchantCandidate = {
      id: `merchant:${merchant.merchantId}`,
      canonicalName: merchant.canonicalName,
      domain: merchant.domain,
      description: merchant.description,
      industry: merchant.industry,
      countryCode: merchant.countryCode,
      explanation: "Refreshing confirmed merchant details.",
      provenance: [{ source: "manual", observedAt: new Date().toISOString() }],
    };
    const provider = new BrandfetchProvider({
      apiKey: runtime.apiKey,
      clientId: runtime.clientId,
      ttlDays: brandfetch.ttlDays,
      responseCache: createBrandfetchResponseCache(projectRoot),
      // Manual refresh should hit Brandfetch, then refresh the local cache.
      bypassCache: true,
    });
    const refreshed = await provider.enrich(candidate);
    if (!refreshed)
      return json(
        { error: "Brandfetch did not return a merchant." },
        { status: 404 },
      );
    let updated = await store.merchants.refresh(
      params.id,
      params.merchantId,
      refreshed,
    );
    if (
      brandfetch.assetMode === "cache" &&
      brandfetch.cacheContentAllowed &&
      refreshed.logoUrl
    ) {
      try {
        const asset = await provider.downloadLogo(refreshed.logoUrl);
        updated = await store.merchants.cacheLogo(
          params.id,
          updated.merchantId,
          asset,
        );
      } catch {
        // A failed optional logo refresh must not discard valid merchant metadata.
      }
    }
    const enrichment = source.merchantEnrichment ?? { enabled: false };
    return json({
      ...updated,
      logoUrl: merchantLogoUrlFor(params.id, updated, {
        ...enrichment,
        brandfetch: enrichment.brandfetch
          ? { ...enrichment.brandfetch, clientId: runtime.clientId }
          : undefined,
      }),
    });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
