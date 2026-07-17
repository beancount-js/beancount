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
}: {
  params: { id: string; merchantId: string };
}) {
  try {
    const store = serverIngestion();
    const config = await store.readConfig(params.id);
    const brandfetch = config.brandfetch;
    if (!brandfetch?.enabled) {
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
    await store.logos.merchantLogo({
      project: params.id,
      merchantId: merchant.merchantId,
      domain: merchant.domain,
      clientId: runtime.clientId,
      force: true,
      settings: {
        delivery: brandfetch.delivery ?? "local-cache",
        refreshDays: brandfetch.refreshDays ?? 30,
        highResolution: brandfetch.highResolution === true,
      },
    });
    const refreshed = await store.merchants.get(params.id, params.merchantId);
    return json({
      ...refreshed,
      logoDelivery: brandfetch.delivery ?? "local-cache",
      logoUrl: merchantLogoUrlFor(params.id, refreshed, {
        enabled: true,
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
