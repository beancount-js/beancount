import {
  brandfetchLogoUrl,
  resolveBrandfetchRuntime,
} from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";
import { logoFallbackResponse } from "$lib/server/logo-fallback";

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
    if (!merchant.domain) return logoFallbackResponse(fallbackLabel);
    const config = await store.readConfig(params.id);
    const brandfetch = config.brandfetch;
    const requestedSize = brandfetch?.highResolution ? 120 : 40;
    const local = await store.merchants.logo(params.id, merchant.merchantId);
    if (local && local.size === requestedSize) {
      if (request.headers.get("if-none-match") === `"${local.sha256}"`)
        return new Response(null, { status: 304 });
      const refreshIn = Math.max(
        0,
        Math.floor((Date.parse(local.expiresAt) - Date.now()) / 1000),
      );
      return new Response(responseBody(local.bytes), {
        headers: {
          "cache-control": `private, max-age=${Math.min(refreshIn, 86_400)}`,
          "content-type": local.mediaType,
          etag: `"${local.sha256}"`,
          "x-logo-source": "local",
        },
      });
    }
    const runtime =
      brandfetch?.enabled && brandfetch
        ? await resolveBrandfetchRuntime(
            brandfetch,
            await store.projectRoot(params.id),
          )
        : undefined;
    if (!runtime?.clientId) return logoFallbackResponse(fallbackLabel);
    return new Response(null, {
      status: 302,
      headers: {
        "cache-control": "private, no-store",
        location: brandfetchLogoUrl(
          merchant.domain,
          runtime.clientId,
          requestedSize,
        ),
        "x-logo-source": "brandfetch-redirect",
      },
    });
  } catch {
    return logoFallbackResponse(fallbackLabel);
  }
}
