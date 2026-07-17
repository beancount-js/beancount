import { resolveBrandfetchRuntime } from "@beancount-js/server";
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
  params: { id: string; domain: string };
  request: Request;
}) {
  try {
    const store = serverIngestion();
    const config = await store.readConfig(params.id);
    if (!config.brandfetch?.enabled) return new Response(null, { status: 404 });
    const runtime = await resolveBrandfetchRuntime(
      config.brandfetch,
      await store.projectRoot(params.id),
    );
    if (!runtime?.clientId) return new Response(null, { status: 404 });
    const logo = await store.logos.proxyDomain({
      project: params.id,
      domain: params.domain,
      clientId: runtime.clientId,
      settings: { highResolution: config.brandfetch.highResolution === true },
    });
    if (request.headers.get("if-none-match") === `"${logo.sha256}"`)
      return new Response(null, { status: 304 });
    return new Response(responseBody(logo.bytes), {
      headers: {
        "content-type": logo.mediaType,
        etag: `"${logo.sha256}"`,
        "cache-control": "private, max-age=3600",
      },
    });
  } catch {
    return logoFallbackResponse(params.domain);
  }
}
