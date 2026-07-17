import { json } from "@sveltejs/kit";
import {
  merchantLogoUrlFor,
  resolveBrandfetchRuntime,
} from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";
import { fuzzySearchMerchants } from "$lib/fuzzy-search";

export async function GET({
  params,
  url,
}: {
  params: { id: string };
  url: URL;
}) {
  try {
    const store = serverIngestion();
    const query = url.searchParams.get("query") ?? "";
    const config = await store.readConfig(params.id);
    const runtime = config.brandfetch
      ? await resolveBrandfetchRuntime(
          config.brandfetch,
          await store.projectRoot(params.id),
        )
      : undefined;
    const brandfetch = config.brandfetch
      ? { ...config.brandfetch, clientId: runtime?.clientId }
      : undefined;

    const merchants = fuzzySearchMerchants(
      await store.merchants.list(params.id),
      query,
    ).map((merchant) => ({
      ...merchant,
      logoUrl: merchantLogoUrlFor(params.id, merchant, {
        enabled: Boolean(config.brandfetch?.enabled),
        brandfetch,
      }),
    }));
    return json(merchants);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
