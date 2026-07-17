import { json } from "@sveltejs/kit";
import type { MerchantCandidate } from "@beancount-js/beangulp";
import {
  brandfetchDomainLogoUrl,
  isValidDomain,
  merchantLogoUrlFor,
  resolveBrandfetchRuntime,
} from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function domainFromUrl(value: unknown) {
  const input = text(value);
  if (!input) return undefined;
  try {
    const url = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`,
    );
    const domain = url.hostname.toLowerCase().replace(/^(?:www\.|api\.)/, "");
    return isValidDomain(domain) ? domain : undefined;
  } catch {
    return undefined;
  }
}

function merchantNameForDomain(domain: string) {
  return (
    domain
      .split(".")[0]
      ?.split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || domain
  );
}

export async function POST({
  params,
  request,
}: {
  params: { id: string };
  request: Request;
}) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const domain = domainFromUrl(body.url);
    if (!domain) {
      return json(
        { error: "Enter a valid public URL to use Brand Match." },
        { status: 400 },
      );
    }

    const account = text(body.account);
    const sourceId =
      text(body.sourceId) ?? (account ? `account:${account}` : undefined);
    if (!sourceId) {
      return json(
        { error: "sourceId or account is required." },
        { status: 400 },
      );
    }

    const sourceName = text(body.sourceName) ?? merchantNameForDomain(domain);
    const store = serverIngestion();
    const config = await store.readConfig(params.id);
    const brandfetch = config.brandfetch;
    if (!brandfetch?.enabled) {
      return json(
        { error: "Enable Brandfetch Logo API before using Brand Match." },
        { status: 400 },
      );
    }
    const runtime = await resolveBrandfetchRuntime(
      brandfetch,
      await store.projectRoot(params.id),
    );
    if (!runtime?.clientId) {
      return json(
        { error: "Brandfetch Logo API client ID is unavailable." },
        { status: 400 },
      );
    }

    const candidate: MerchantCandidate = {
      id: `brand-match:${domain}`,
      canonicalName: sourceName,
      domain,
      description: `Merchant created from ${domain}.`,
      explanation: "Brand Match used the supplied URL to attach a logo.",
      provenance: [
        {
          source: "manual",
          provider: "brand-match-url",
          observedAt: new Date().toISOString(),
        },
        {
          source: "brandfetch",
          provider: "logo-api",
          version: "cdn",
          observedAt: new Date().toISOString(),
        },
      ],
      logoUrl: brandfetchDomainLogoUrl(params.id, domain),
    };
    const existing = await store.merchants.findByDomain(params.id, domain);
    const merchant = await store.merchants.confirm(params.id, {
      sourceId,
      rawLabel: sourceName,
      candidate,
      targetMerchantId: existing?.merchantId,
    });

    return json({
      ...merchant,
      logoUrl: merchantLogoUrlFor(params.id, merchant, {
        enabled: true,
        brandfetch: { ...brandfetch, clientId: runtime.clientId },
      }),
    });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
