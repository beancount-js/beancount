import {
  exampleIngestionConfig,
  type EditableIngestionSource,
} from "./source-form";

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

const lunchFlowSource: EditableIngestionSource = {
  id: "lunchflow",
  name: "Lunch Flow",
  kind: "json-api",
  aiEnabled: false,
  setup: [
    "1. Go to [Lunch Flow](https://lunchflow.app/) and create an API key.",
    "2. Paste the API key and confirm the base URL below, then save the connection.",
    "3. Open **Settings → Accounts** to load and link the bank accounts you want to import.",
  ].join("\n"),
  merchantEnrichment: {
    enabled: true,
    aiEnabled: false,
    countryCode: "GB",
    brandfetch: {
      enabled: false,
      apiKeySecretRef: "env:BRANDFETCH_API_KEY",
      clientId: "env:BRANDFETCH_CLIENT_ID",
      assetMode: "hotlink",
    },
  },
  api: {
    baseUrl: "https://www.lunchflow.app/api/v1",
    allowedHosts: ["lunchflow.app", "www.lunchflow.app"],
    secretRef: "env:LUNCHFLOW_API_KEY",
    authScheme: "x-api-key",
    recordsPath: "transactions",
  },
  mapping: {
    id: "id",
    date: "date",
    amount: "amount",
    currency: "currency",
    merchant: "merchant",
    narration: "description",
    status: "isPending",
  },
  accounts: [],
  rules: [],
};

/** Catalog of pre-configured sources shown under the connections preview. */
export const ingestionSamples: IngestionSample[] = [
  {
    id: "lunchflow",
    name: "Lunch Flow",
    initials: "LF",
    accentClass: "bg-orange-600",
    region: "Global",
    category: "Bank aggregation",
    description:
      "Import transactions from banks connected through Lunch Flow’s JSON API.",
    badge: "Beta",
    provider: {
      id: "lunchflow",
      baseUrl: "https://www.lunchflow.app/api/v1",
      accountsPath: "accounts",
    },
    template: structuredClone(lunchFlowSource),
  },
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
