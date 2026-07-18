import type {
  ConnectorDefinition,
  ConnectorSourceDefinition,
  DiscoveredConnectorAccount,
  ExpandedConnectorTarget,
  SourceContext,
} from "@beancount-js/beangulp";
import { connectorAccountSourceId } from "@beancount-js/beangulp";
import { LunchflowNormalizer } from "./normalize";
import { discoverLunchflowAccounts, LunchflowSource } from "./source";
import { commitLunchflowSyncState, prepareLunchflowFetch } from "./sync";
import type { LunchflowConfig, LunchflowSyncState } from "./types";
import {
  DEFAULT_BASE_URL,
  DEFAULT_LOOKBACK_DAYS,
  LUNCHFLOW_KIND,
  MAX_SYNC_HISTORY_YEARS,
} from "./types";

const DEFAULT_ALLOWED_HOSTS = ["lunchflow.app", "www.lunchflow.app"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const next = value.trim();
  return next || undefined;
}

function validateHttpsUrl(
  value: string,
  allowedHosts: readonly string[] | undefined,
  label: string,
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  const isLocalHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1");
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error(
      `${label} must use HTTPS (HTTP is allowed only for localhost).`,
    );
  }
  const hosts = allowedHosts
    ?.map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (hosts?.length && !hosts.includes(url.hostname.toLowerCase())) {
    throw new Error(`${label} is not in this source's allowlist.`);
  }
  return url;
}

export function validateLunchflowConfig(value: unknown): LunchflowConfig {
  if (!isRecord(value)) {
    throw new Error("Lunch Flow config must be an object.");
  }
  const secretRef = optionalString(value.secretRef);
  if (!secretRef) {
    throw new Error("Lunch Flow needs an API key (or env: reference).");
  }
  if (secretRef.startsWith("env:") && !secretRef.slice("env:".length).trim()) {
    throw new Error("Environment credential references need a variable name.");
  }
  const baseUrl = optionalString(value.baseUrl) || DEFAULT_BASE_URL;
  const allowedHosts = Array.isArray(value.allowedHosts)
    ? value.allowedHosts
        .filter((host): host is string => typeof host === "string")
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean)
    : DEFAULT_ALLOWED_HOSTS;
  validateHttpsUrl(baseUrl, allowedHosts, "Lunch Flow base URL");

  let syncStartDate = optionalString(value.syncStartDate);
  if (syncStartDate) {
    const parsed = new Date(`${syncStartDate}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(
        "syncStartDate must be an ISO calendar date (yyyy-MM-dd).",
      );
    }
    const earliest = new Date();
    earliest.setUTCFullYear(earliest.getUTCFullYear() - MAX_SYNC_HISTORY_YEARS);
    if (parsed < earliest) {
      throw new Error(
        `syncStartDate cannot be more than ${MAX_SYNC_HISTORY_YEARS} years ago.`,
      );
    }
  }

  let lookbackDays = DEFAULT_LOOKBACK_DAYS;
  if (value.lookbackDays !== undefined) {
    if (
      typeof value.lookbackDays !== "number" ||
      !Number.isInteger(value.lookbackDays) ||
      value.lookbackDays < 0 ||
      value.lookbackDays > 90
    ) {
      throw new Error("lookbackDays must be an integer from 0 to 90.");
    }
    lookbackDays = value.lookbackDays;
  }

  const includePending =
    value.includePending === undefined ? true : value.includePending === true;
  if (
    value.includePending !== undefined &&
    typeof value.includePending !== "boolean"
  ) {
    throw new Error("includePending must be a boolean.");
  }

  return {
    secretRef,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    allowedHosts,
    syncStartDate,
    lookbackDays,
    includePending,
  };
}

function defaultLunchflowConfig(): LunchflowConfig {
  return {
    secretRef: "env:LUNCHFLOW_API_KEY",
    baseUrl: DEFAULT_BASE_URL,
    allowedHosts: [...DEFAULT_ALLOWED_HOSTS],
    lookbackDays: DEFAULT_LOOKBACK_DAYS,
    includePending: true,
  };
}

export const lunchflowConnector: ConnectorDefinition<
  LunchflowConfig,
  LunchflowSyncState
> = {
  kind: LUNCHFLOW_KIND,
  name: "Lunch Flow",
  description:
    "Import transactions from banks connected through Lunch Flow’s JSON API.",
  catalog: {
    initials: "LF",
    accentClass: "bg-orange-600",
    region: "Global",
    category: "Bank aggregation",
    badge: "Beta",
  },
  capabilities: {
    groupedAccounts: true,
    discoverAccounts: true,
  },
  setupMarkdown: [
    "1. Go to [Lunch Flow](https://lunchflow.app/) and create an API key.",
    "2. Paste the API key and confirm the base URL below, then save the connection.",
    "3. Open **Settings → Accounts** to load and link the bank accounts you want to import.",
  ].join("\n"),
  connectionFields: [
    {
      id: "secretRef",
      label: "API key",
      kind: "secret",
      path: "secretRef",
      placeholder: "env:LUNCHFLOW_API_KEY",
    },
    {
      id: "baseUrl",
      label: "Base URL",
      kind: "url",
      path: "baseUrl",
      placeholder: DEFAULT_BASE_URL,
      default: DEFAULT_BASE_URL,
    },
  ],
  advancedFields: [
    {
      id: "syncStartDate",
      label: "Initial sync from",
      kind: "text",
      path: "syncStartDate",
      placeholder: "yyyy-MM-dd",
    },
    {
      id: "lookbackDays",
      label: "Lookback days",
      kind: "text",
      path: "lookbackDays",
      placeholder: String(DEFAULT_LOOKBACK_DAYS),
      default: DEFAULT_LOOKBACK_DAYS,
    },
    {
      id: "includePending",
      label: "Include pending",
      kind: "switch",
      path: "includePending",
      default: true,
    },
  ],
  defaultConfig: defaultLunchflowConfig,
  validateConfig: validateLunchflowConfig,
  createSource() {
    return new LunchflowSource();
  },
  createNormalizer() {
    return new LunchflowNormalizer();
  },
  async discoverAccounts(
    config: LunchflowConfig,
    ctx: SourceContext,
  ): Promise<DiscoveredConnectorAccount[]> {
    return discoverLunchflowAccounts(config, ctx);
  },
  expandTargets(
    source: ConnectorSourceDefinition<LunchflowConfig>,
    opts?: { accountId?: string },
  ): ExpandedConnectorTarget[] {
    const linked = source.accounts ?? [];
    const selected = opts?.accountId
      ? linked.filter((account) => account.id === opts.accountId)
      : linked;
    if (opts?.accountId && !selected.length) {
      throw new Error(
        `Unknown linked account ${opts.accountId} on source ${source.id}.`,
      );
    }
    if (!selected.length) {
      throw new Error(`Source ${source.id} has no linked accounts to ingest.`);
    }
    return selected.map((account) => ({
      sourceId: connectorAccountSourceId(source.id, account.id),
      sourceAccount: account.sourceAccount,
      defaultCurrency: account.defaultCurrency ?? source.defaultCurrency,
      accountId: account.id,
    }));
  },
  prepareFetch: prepareLunchflowFetch,
  commitSyncState(args) {
    return commitLunchflowSyncState({
      previous: args.previous,
      prepare: args.prepare,
      now: args.now,
    });
  },
};
