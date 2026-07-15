import { json } from "@sveltejs/kit";
import { merchantLogoUrlFor } from "@beancount-js/server";
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
      ? await store.source(params.id, sourceId)
      : undefined;
    return json({
      ...merchant,
      logoUrl: source
        ? merchantLogoUrlFor(
            params.id,
            merchant,
            source.merchantEnrichment ?? { enabled: false },
          )
        : undefined,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 404 },
    );
  }
}
