import { json } from "@sveltejs/kit";
import {
  downloadBrandfetchLogo,
  merchantLogoUrlFor,
  resolveBrandfetchRuntime,
} from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function reloadUrl(url: string | undefined) {
  if (!url) return undefined;
  return `${url}${url.includes("?") ? "&" : "?"}reload=${Date.now()}`;
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
    let merchant = await store.merchants.get(params.id, params.merchantId);
    if (!merchant.domain)
      return json(
        { error: "This merchant has no confirmed domain." },
        { status: 400 },
      );
    if (brandfetch.cacheUserAgent) {
      try {
        const fetched = await downloadBrandfetchLogo({
          domain: merchant.domain,
          clientId: runtime.clientId,
          size: brandfetch.highResolution ? 120 : 40,
          userAgent: brandfetch.cacheUserAgent,
        });
        merchant = await store.merchants.cacheLogo(
          params.id,
          merchant.merchantId,
          fetched,
        );
      } catch {
        // Return the normal browser-delivery URL below.
      }
    }
    const logoUrl = merchantLogoUrlFor(params.id, merchant, {
      enabled: true,
      brandfetch: {
        ...brandfetch,
        clientId: runtime.clientId,
      },
    });
    if (!logoUrl) {
      return json(
        { error: "A browser logo URL could not be created." },
        { status: 400 },
      );
    }
    return json({
      ...merchant,
      logoUrl: reloadUrl(logoUrl),
    });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
