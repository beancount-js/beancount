import { json } from "@sveltejs/kit";
import type { MerchantCandidate } from "@beancount-js/beangulp";
import {
  BrandfetchProvider,
  createBrandfetchResponseCache,
  isValidDomain,
  merchantLogoUrlFor,
  resolveBrandfetchRuntime,
  type IngestionSourceDefinition,
} from "@beancount-js/server";
import { serverIngestion } from "$lib/server/ingestion";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function sourceApiUrl(source: IngestionSourceDefinition) {
  const connectorConfig = source.config;
  if (
    connectorConfig &&
    typeof connectorConfig === "object" &&
    !Array.isArray(connectorConfig)
  ) {
    const baseUrl = (connectorConfig as { baseUrl?: unknown }).baseUrl;
    if (typeof baseUrl === "string" && baseUrl.trim()) return baseUrl;
  }
  return source.api?.baseUrl ?? source.api?.endpoint;
}

function sourceDomain(source: IngestionSourceDefinition) {
  const value = sourceApiUrl(source)?.trim();
  if (!value) return undefined;
  try {
    const hostname = new URL(value).hostname
      .toLowerCase()
      .replace(/^(?:www\.|api\.)/, "");
    return isValidDomain(hostname) ? hostname : undefined;
  } catch {
    return undefined;
  }
}

export async function POST({
  params,
}: {
  params: { id: string; sourceId: string };
}) {
  try {
    const store = serverIngestion();
    const config = await store.readConfig(params.id);
    const source = config.sources.find((item) => item.id === params.sourceId);
    if (!source)
      return json({ error: "Connection was not found." }, { status: 404 });

    const domain = sourceDomain(source);
    if (!domain) {
      return json(
        { error: "This connection does not have a valid API URL to identify." },
        { status: 400 },
      );
    }

    const brandfetch = config.brandfetch;
    if (!brandfetch?.enabled || !brandfetch.apiKeySecretRef.trim()) {
      return json(
        { error: "Enable Brandfetch before updating a connection logo." },
        { status: 400 },
      );
    }
    const projectRoot = await store.projectRoot(params.id);
    const runtime = await resolveBrandfetchRuntime(brandfetch, projectRoot);
    if (!runtime?.apiKey) {
      return json(
        { error: "Brandfetch credential is unavailable." },
        { status: 400 },
      );
    }

    const candidate: MerchantCandidate = {
      id: `connection:${source.id}`,
      canonicalName: source.name,
      domain,
      description: `Bank connection for ${source.name}.`,
      explanation: "Created from the connection API URL.",
      provenance: [
        {
          source: "manual",
          provider: "connection-api-url",
          observedAt: new Date().toISOString(),
        },
      ],
    };
    const provider = new BrandfetchProvider({
      apiKey: runtime.apiKey,
      clientId: runtime.clientId,
      ttlDays: brandfetch.ttlDays,
      responseCache: createBrandfetchResponseCache(projectRoot),
      bypassCache: true,
    });
    const enriched = await provider.enrich(candidate);
    if (!enriched) {
      return json(
        { error: "Brandfetch did not return a merchant for this connection." },
        { status: 404 },
      );
    }

    let existing = source.merchantId
      ? await store.merchants
          .get(params.id, source.merchantId)
          .catch(() => undefined)
      : undefined;
    existing ??= await store.merchants.findByDomain(params.id, domain);
    let merchant = await store.merchants.confirm(params.id, {
      sourceId: source.id,
      rawLabel: source.name,
      candidate: enriched,
      targetMerchantId: existing?.merchantId,
    });
    if (
      brandfetch.assetMode === "cache" &&
      brandfetch.cacheContentAllowed &&
      enriched.logoUrl
    ) {
      try {
        merchant = await store.merchants.cacheLogo(
          params.id,
          merchant.merchantId,
          await provider.downloadLogo(enriched.logoUrl),
        );
      } catch {
        // Do not discard confirmed metadata when the optional logo asset fails.
      }
    }

    await store.writeConfig(params.id, {
      ...config,
      sources: config.sources.map((item) =>
        item.id === source.id
          ? { ...item, merchantId: merchant.merchantId }
          : item,
      ),
    });
    const persisted = await store.readConfig(params.id);
    const persistedSource = persisted.sources.find(
      (item) => item.id === source.id,
    );
    if (!persistedSource) throw new Error("Connection was not persisted.");

    return json({
      source: persistedSource,
      merchant: {
        ...merchant,
        logoUrl: merchantLogoUrlFor(params.id, merchant, {
          enabled: true,
          brandfetch: { ...brandfetch, clientId: runtime.clientId },
        }),
      },
    });
  } catch (error) {
    return json({ error: message(error) }, { status: 400 });
  }
}
