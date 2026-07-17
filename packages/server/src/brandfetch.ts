import { createHash } from "node:crypto";
import type { MerchantBrandAsset } from "@beancount-js/beangulp";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 30 * 86_400_000;

export type BrandfetchLogoSize = 40 | 120;

export interface DownloadedBrandfetchLogo {
  bytes: Uint8Array;
  mediaType: MerchantBrandAsset["mediaType"];
  extension: "png" | "jpg" | "webp";
  sha256: string;
  size: BrandfetchLogoSize;
  expiresAt: string;
}

/** Brandfetch Logo API uses a public CDN URL and a client ID per image. */
export function brandfetchLogoUrl(
  domain: string,
  clientId: string,
  size: BrandfetchLogoSize = 40,
) {
  const identifier = encodeURIComponent(domain.toLowerCase());
  const client = encodeURIComponent(clientId);
  return `https://cdn.brandfetch.io/${identifier}/h/${size}/w/${size}/icon.png?c=${client}`;
}

export function isValidDomain(value: string | undefined) {
  if (!value || value.length > 253 || /[/:?#\s]/.test(value)) return false;
  const domain = value.toLowerCase().replace(/\.$/, "");
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
    domain,
  );
}

function isBrandfetchHost(url: URL) {
  return (
    url.protocol === "https:" &&
    (url.hostname === "cdn.brandfetch.io" ||
      url.hostname.endsWith(".brandfetch.io"))
  );
}

function imageType(
  bytes: Uint8Array,
): Pick<DownloadedBrandfetchLogo, "mediaType" | "extension"> | undefined {
  const png =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  if (png) return { mediaType: "image/png", extension: "png" };
  const jpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  if (jpeg) return { mediaType: "image/jpeg", extension: "jpg" };
  const webp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (webp) return { mediaType: "image/webp", extension: "webp" };
  return undefined;
}

async function readImage(response: Response) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_LOGO_BYTES) {
    throw new Error("Brandfetch logo exceeds the 2 MiB limit.");
  }
  if (!response.body) throw new Error("Brandfetch returned an empty logo.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_LOGO_BYTES) {
      await reader.cancel();
      throw new Error("Brandfetch logo exceeds the 2 MiB limit.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Experimental server-side cache fill. It only runs with an explicitly
 * configured User-Agent and follows redirects within Brandfetch's CDN.
 */
export async function downloadBrandfetchLogo(options: {
  domain: string;
  clientId: string;
  size: BrandfetchLogoSize;
  userAgent: string;
  fetcher?: typeof fetch;
}) {
  if (!isValidDomain(options.domain)) throw new Error("Invalid logo domain.");
  if (!options.userAgent.trim())
    throw new Error("A cache User-Agent is required.");
  const fetcher = options.fetcher ?? fetch;
  let url = new URL(
    brandfetchLogoUrl(options.domain, options.clientId, options.size),
  );
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (!isBrandfetchHost(url)) {
      throw new Error("Invalid Brandfetch logo host.");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: {
          accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
          "user-agent": options.userAgent,
        },
        redirect: "manual",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === MAX_REDIRECTS) {
        throw new Error("Brandfetch logo redirect could not be followed.");
      }
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) {
      throw new Error(`Brandfetch logo request failed (${response.status}).`);
    }
    const bytes = await readImage(response);
    const type = imageType(bytes);
    if (!type)
      throw new Error("Brandfetch returned an unsupported logo image.");
    return {
      bytes,
      ...type,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      size: options.size,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    } satisfies DownloadedBrandfetchLogo;
  }
  throw new Error("Brandfetch logo redirect could not be followed.");
}
