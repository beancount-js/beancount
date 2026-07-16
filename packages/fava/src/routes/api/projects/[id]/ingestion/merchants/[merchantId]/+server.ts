import { json } from "@sveltejs/kit";
import {
  merchantLogoUrlFor,
  resolveBrandfetchRuntime,
} from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";

export async function GET({
  params,
  url,
}: {
  params: { id: string; merchantId: string };
  url: URL;
}) {
  try {
    const store = serverIngestion();
    const merchant = await store.merchants.get(params.id, params.merchantId);
    const sourceId = url.searchParams.get("sourceId");
    const source = sourceId
      ? await store.sourceForRunSourceId(params.id, sourceId)
      : undefined;
    const enrichment = source?.merchantEnrichment;
    const runtime = enrichment?.brandfetch
      ? await resolveBrandfetchRuntime(
          enrichment.brandfetch,
          await store.projectRoot(params.id),
        )
      : undefined;
    return json({
      ...merchant,
      logoUrl:
        source && enrichment
          ? merchantLogoUrlFor(params.id, merchant, {
              ...enrichment,
              brandfetch: enrichment.brandfetch
                ? { ...enrichment.brandfetch, clientId: runtime?.clientId }
                : undefined,
            })
          : undefined,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 404 },
    );
  }
}
