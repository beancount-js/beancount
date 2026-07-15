import { json } from "@sveltejs/kit";
import { normalizeMerchant } from "@beancount-js/beangulp";
import { serverIngestion } from "$lib/server/ingestion";

export async function GET({
  params,
  url,
}: {
  params: { id: string };
  url: URL;
}) {
  try {
    const query = normalizeMerchant(url.searchParams.get("query") ?? "");
    const merchants = (
      await serverIngestion().merchants.list(params.id)
    ).filter(
      (merchant) =>
        !query ||
        normalizeMerchant(merchant.canonicalName).includes(query) ||
        merchant.aliases.some((alias) => alias.normalizedValue.includes(query)),
    );
    return json(merchants);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
