import { json } from "@sveltejs/kit";
import type { MerchantIdentity } from "@beancount-js/beangulp";
import {
  merchantLogoUrlFor,
  resolveBrandfetchRuntime,
  type UpdateMerchantInput,
} from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";

function stringField(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function parseUpdateBody(body: unknown): UpdateMerchantInput {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  return {
    canonicalName: stringField(record.canonicalName),
    domain: stringField(record.domain),
    description: stringField(record.description),
    industry: stringField(record.industry),
    countryCode: stringField(record.countryCode),
    notes: stringField(record.notes),
  };
}

async function logoUrlFor(projectId: string, merchant: MerchantIdentity) {
  const store = serverIngestion();
  const config = await store.readConfig(projectId);
  const runtime = config.brandfetch
    ? await resolveBrandfetchRuntime(
        config.brandfetch,
        await store.projectRoot(projectId),
      )
    : undefined;
  const brandfetch = config.brandfetch
    ? { ...config.brandfetch, clientId: runtime?.clientId }
    : undefined;
  return merchantLogoUrlFor(projectId, merchant, {
    enabled: Boolean(config.brandfetch?.enabled),
    brandfetch,
  });
}

export async function GET({
  params,
  url,
}: {
  params: { id: string; merchantId: string };
  url: URL;
}) {
  try {
    const store = serverIngestion();
    const details = await store.merchants.getDetails(
      params.id,
      params.merchantId,
    );
    const sourceId = url.searchParams.get("sourceId");
    const source = sourceId
      ? await store.sourceForRunSourceId(params.id, sourceId)
      : undefined;
    const enrichment = source?.merchantEnrichment;
    const config = await store.readConfig(params.id);
    const runtime = config.brandfetch
      ? await resolveBrandfetchRuntime(
          config.brandfetch,
          await store.projectRoot(params.id),
        )
      : undefined;
    return json({
      ...details,
      logoUrl:
        source && enrichment
          ? merchantLogoUrlFor(params.id, details, {
              ...enrichment,
              brandfetch: config.brandfetch
                ? { ...config.brandfetch, clientId: runtime?.clientId }
                : undefined,
            })
          : await logoUrlFor(params.id, details),
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 404 },
    );
  }
}

export async function PATCH({
  params,
  request,
}: {
  params: { id: string; merchantId: string };
  request: Request;
}) {
  try {
    const store = serverIngestion();
    const input = parseUpdateBody(await request.json());
    if (
      input.canonicalName === undefined &&
      input.domain === undefined &&
      input.description === undefined &&
      input.industry === undefined &&
      input.countryCode === undefined &&
      input.notes === undefined
    ) {
      return json(
        { error: "Provide at least one merchant field to update." },
        { status: 400 },
      );
    }
    const details = await store.merchants.update(
      params.id,
      params.merchantId,
      input,
    );
    return json({
      ...details,
      logoUrl: await logoUrlFor(params.id, details),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const notFound =
      message.includes("ENOENT") ||
      /no such file|not found|missing/i.test(message);
    return json(
      { error: message },
      { status: notFound ? 404 : 400 },
    );
  }
}
