import {
  exampleIngestionConfig,
  type EditableIngestionSource,
} from "./source-form";
import { clientConnectors, ensureClientConnectors } from "./connectors";

export type IngestionSampleProvider = {
  id: string;
  baseUrl: string;
  accountsPath?: string;
};

export type IngestionSample = {
  id: string;
  name: string;
  initials: string;
  /** Tailwind background class for the initials tile */
  accentClass: string;
  region: string;
  category: string;
  description: string;
  badge?: string;
  /** Optional provider metadata (kept for catalog display / discover defaults). */
  provider?: IngestionSampleProvider;
  template: EditableIngestionSource;
};

const exampleSource = exampleIngestionConfig.sources[0]!;

/**
 * Accent classes must appear as string literals in this package so Tailwind's
 * content scanner includes them (connector packages are outside `content`).
 */
function connectorAccentClass(kind: string, fallback: string) {
  if (kind === "lunchflow") return "bg-orange-600";
  if (kind === "monzo") return "bg-rose-600";
  if (kind === "starling") return "bg-violet-700";
  return fallback;
}

function connectorSamples(): IngestionSample[] {
  ensureClientConnectors();
  return clientConnectors().map((connector) => {
    const config = connector.defaultConfig() as Record<string, unknown>;
    const baseUrl =
      typeof config.baseUrl === "string" ? config.baseUrl : undefined;
    return {
      id: connector.kind,
      name: connector.name,
      initials: connector.catalog.initials,
      accentClass: connectorAccentClass(
        connector.kind,
        connector.catalog.accentClass,
      ),
      region: connector.catalog.region,
      category: connector.catalog.category,
      description: connector.description,
      badge: connector.catalog.badge,
      provider: baseUrl
        ? {
            id: connector.kind,
            baseUrl,
            accountsPath: "accounts",
          }
        : undefined,
      template: {
        id: connector.kind,
        name: connector.name,
        kind: connector.kind,
        merchantId: "",
        aiEnabled: false,
        setup: connector.setupMarkdown,
        merchantEnrichment: {
          enabled: true,
          aiEnabled: false,
          countryCode: "GB",
        },
        config: structuredClone(config),
        accounts: connector.capabilities.groupedAccounts ? [] : undefined,
        rules: [],
      },
    } satisfies IngestionSample;
  });
}

/** Catalog of pre-configured sources shown under the connections preview. */
export const ingestionSamples: IngestionSample[] = [
  ...connectorSamples(),
  {
    id: "example-bank",
    name: "Example bank",
    initials: "EX",
    accentClass: "bg-emerald-700",
    region: "Global",
    category: "Bank",
    description:
      "Sample JSON API bank feed with mapping, pagination, and a grocery rule.",
    badge: "Sample",
    template: {
      ...structuredClone(exampleSource),
      id: "example-bank",
      name: "Example bank",
      setup: [
        "1. Go to [api.example.com](https://api.example.com) and create an API key.",
        "2. Paste the API key below (or switch to Environment and enter a variable name) and connect.",
        "3. Then head to Review imports to fetch and categorise.",
      ].join("\n"),
    },
  },
];

/**
 * Catalog entries that are not already configured in the current source list.
 * Connector samples are unique per provider, while standalone samples match by
 * their configured source id.
 */
export function availableIngestionSamples(
  sources: readonly Pick<EditableIngestionSource, "id" | "kind">[],
  samples: readonly IngestionSample[] = ingestionSamples,
): IngestionSample[] {
  return samples.filter(
    (sample) =>
      !sources.some(
        (source) =>
          source.id === sample.template.id ||
          (sample.template.kind !== "json-api" &&
            source.kind === sample.template.kind),
      ),
  );
}
