import { json } from "@sveltejs/kit";
import {
  merchantLogoUrlFor,
  resolveBrandfetchRuntime,
} from "@beancount-js/server";
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
    const config = await store.readConfig(params.id);
    const brandfetch = config.brandfetch;
    if (!source.merchantEnrichment?.enabled || !brandfetch?.enabled) {
      return json(
        { error: "Brandfetch Logo API is not enabled." },
        { status: 400 },
      );
    }
    const projectRoot = await store.projectRoot(params.id);
    const runtime = await resolveBrandfetchRuntime(brandfetch, projectRoot);
    if (!runtime?.clientId)
      return json(
        { error: "Brandfetch Logo API client ID is unavailable." },
        { status: 400 },
      );
    const merchant = await store.merchants.get(params.id, params.merchantId);
    if (!merchant.domain)
      return json(
        { error: "This merchant has no confirmed domain." },
        { status: 400 },
      );
    const enrichment = source.merchantEnrichment ?? { enabled: false };
    return json({
      ...merchant,
      logoUrl: merchantLogoUrlFor(params.id, merchant, {
        ...enrichment,
        brandfetch: {
          ...brandfetch,
          clientId: runtime.clientId,
        },
      }),
    });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
