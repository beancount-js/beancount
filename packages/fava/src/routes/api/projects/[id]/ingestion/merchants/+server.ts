import { json } from "@sveltejs/kit";
import { normalizeMerchant } from "@beancount-js/beangulp";
import {
  merchantLogoUrlFor,
  resolveBrandfetchRuntime,
} from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";

export async function GET({
  params,
  url,
}: {
  params: { id: string };
  url: URL;
}) {
  try {
    const store = serverIngestion();
    const query = normalizeMerchant(url.searchParams.get("query") ?? "");
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

    const tokens = query ? query.split(/\s+/).filter(Boolean) : [];
    const merchants = (await store.merchants.list(params.id))
      .filter((merchant) => {
        if (!tokens.length) return true;
        const haystack = [
          normalizeMerchant(merchant.canonicalName),
          normalizeMerchant(merchant.domain),
          ...merchant.aliases.map((alias) => alias.normalizedValue),
        ].join(" ");
        // Every token must appear somewhere (name, domain, or alias).
        return tokens.every((token) => haystack.includes(token));
      })
      .map((merchant) => ({
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
