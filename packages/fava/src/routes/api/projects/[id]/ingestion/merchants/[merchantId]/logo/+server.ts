import { serverIngestion } from "$lib/server/ingestion";

export async function GET({
  params,
  request,
}: {
  params: { id: string; merchantId: string };
  request: Request;
}) {
  try {
    const logo = await serverIngestion().merchants.logo(
      params.id,
      params.merchantId,
    );
    if (!logo) return new Response(null, { status: 404 });
    if (request.headers.get("if-none-match") === `"${logo.sha256}"`)
      return new Response(null, { status: 304 });
    const maxAge = Math.max(
      0,
      Math.floor((Date.parse(logo.expiresAt) - Date.now()) / 1000),
    );
    return new Response(logo.bytes, {
      headers: {
        "content-type": logo.mediaType,
        etag: `"${logo.sha256}"`,
        "cache-control": `private, max-age=${maxAge}`,
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
