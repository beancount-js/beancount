import { resolveBrandfetchRuntime } from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";
import { logoFallbackResponse } from "$lib/server/logo-fallback";

function settings(brandfetch: {
  delivery?: "local-cache" | "server-proxy";
  refreshDays?: number;
  highResolution?: boolean;
}) {
  return {
    delivery: brandfetch.delivery ?? "local-cache",
    refreshDays: brandfetch.refreshDays ?? 30,
    highResolution: brandfetch.highResolution === true,
  } as const;
}

function responseBody(bytes: Uint8Array) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

export async function GET({
  params,
  request,
}: {
  params: { id: string; merchantId: string };
  request: Request;
}) {
  let fallbackLabel = params.merchantId;
  try {
    const store = serverIngestion();
    const merchant = await store.merchants.get(params.id, params.merchantId);
    fallbackLabel = merchant.canonicalName || fallbackLabel;
    const config = await store.readConfig(params.id);
    const brandfetch = config.brandfetch;
    const runtime =
      brandfetch?.enabled && brandfetch
        ? await resolveBrandfetchRuntime(
            brandfetch,
            await store.projectRoot(params.id),
          )
        : undefined;
    const logo = await store.logos.merchantLogo({
      project: params.id,
      merchantId: merchant.merchantId,
      domain: merchant.domain,
      clientId: runtime?.clientId,
      settings: settings(brandfetch ?? {}),
    });
    if (!logo) return new Response(null, { status: 404 });
    if (request.headers.get("if-none-match") === `"${logo.sha256}"`)
      return new Response(null, { status: 304 });
    const refreshIn = Math.max(
      0,
      Math.floor((Date.parse(logo.expiresAt) - Date.now()) / 1000),
    );
    const maxAge = logo.persisted ? Math.min(refreshIn, 86_400) : 3_600;
    return new Response(responseBody(logo.bytes), {
      headers: {
        "content-type": logo.mediaType,
        etag: `"${logo.sha256}"`,
        "cache-control": `private, max-age=${maxAge}`,
      },
    });
  } catch {
    return logoFallbackResponse(fallbackLabel);
  }
}
