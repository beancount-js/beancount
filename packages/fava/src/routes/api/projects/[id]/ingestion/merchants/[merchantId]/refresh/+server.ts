import { json } from "@sveltejs/kit";
import { BrandfetchProvider, merchantLogoUrlFor } from "@beancount-js/server";
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
    const source = await store.source(params.id, body.sourceId);
    const brandfetch = source.merchantEnrichment?.brandfetch;
    if (
      !source.merchantEnrichment?.enabled ||
      !brandfetch?.enabled ||
      !brandfetch.apiKeySecretRef.startsWith("env:")
    ) {
      return json(
        { error: "Brandfetch enrichment is not enabled." },
        { status: 400 },
      );
    }
    const apiKey = process.env[brandfetch.apiKeySecretRef.slice(4)];
    if (!apiKey)
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
    const refreshed = await new BrandfetchProvider({
      apiKey,
      clientId: brandfetch.clientId,
      ttlDays: brandfetch.ttlDays,
    }).enrich(candidate);
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
        const asset = await new BrandfetchProvider({
          apiKey,
          clientId: brandfetch.clientId,
          ttlDays: brandfetch.ttlDays,
        }).downloadLogo(refreshed.logoUrl);
        updated = await store.merchants.cacheLogo(
          params.id,
          updated.merchantId,
          asset,
        );
      } catch {
        // A failed optional logo refresh must not discard valid merchant metadata.
      }
    }
    return json({
      ...updated,
      logoUrl: merchantLogoUrlFor(
        params.id,
        updated,
        source.merchantEnrichment ?? { enabled: false },
      ),
    });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
