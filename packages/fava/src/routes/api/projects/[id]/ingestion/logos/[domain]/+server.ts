import {
  brandfetchLogoUrl,
  isValidDomain,
  resolveBrandfetchRuntime,
} from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";

export async function GET({
  params,
}: {
  params: { id: string; domain: string };
}) {
  try {
    if (!isValidDomain(params.domain))
      return new Response(null, { status: 404 });
    const store = serverIngestion();
    const config = await store.readConfig(params.id);
    if (!config.brandfetch?.enabled) return new Response(null, { status: 404 });
    const runtime = await resolveBrandfetchRuntime(
      config.brandfetch,
      await store.projectRoot(params.id),
    );
    if (!runtime?.clientId) return new Response(null, { status: 404 });
    return new Response(null, {
      status: 302,
      headers: {
        "cache-control": "private, no-store",
        location: brandfetchLogoUrl(
          params.domain,
          runtime.clientId,
          config.brandfetch.highResolution ? 120 : 40,
        ),
        "x-logo-source": "brandfetch-redirect",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
