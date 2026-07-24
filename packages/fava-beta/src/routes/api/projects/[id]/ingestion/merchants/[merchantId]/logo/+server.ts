import {
  brandfetchLogoUrl,
  downloadBrandfetchLogo,
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

function imageResponse(
  logo: {
    bytes: Uint8Array;
    mediaType: string;
    sha256: string;
    expiresAt: string;
  },
  source: "local" | "server-cache",
  request: Request,
) {
  if (request.headers.get("if-none-match") === `"${logo.sha256}"`) {
    return new Response(null, { status: 304 });
  }
  const refreshIn = Math.max(
    0,
    Math.floor((Date.parse(logo.expiresAt) - Date.now()) / 1000),
  );
  return new Response(responseBody(logo.bytes), {
    headers: {
      "cache-control": `private, max-age=${Math.min(refreshIn, 86_400)}`,
      "content-type": logo.mediaType,
      etag: `"${logo.sha256}"`,
      "x-logo-source": source,
    },
  });
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
      return imageResponse(local, "local", request);
    }
    const runtime =
      brandfetch?.enabled && brandfetch
        ? await resolveBrandfetchRuntime(
            brandfetch,
            await store.projectRoot(params.id),
          )
        : undefined;
    if (!brandfetch || !runtime?.clientId) {
      return logoFallbackResponse(fallbackLabel);
    }
    if (brandfetch.cacheUserAgent) {
      try {
        const fetched = await downloadBrandfetchLogo({
          domain: merchant.domain,
          clientId: runtime.clientId,
          size: requestedSize,
          userAgent: brandfetch.cacheUserAgent,
        });
        await store.merchants.cacheLogo(
          params.id,
          merchant.merchantId,
          fetched,
        );
        return imageResponse(fetched, "server-cache", request);
      } catch {
        // Fall through to the direct browser delivery path.
      }
    }
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
