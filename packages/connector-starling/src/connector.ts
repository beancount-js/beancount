import { DateTime } from "luxon";
import type {
  ConnectorDefinition,
  ConnectorSourceDefinition,
  DiscoveredConnectorAccount,
  ExpandedConnectorTarget,
  SourceContext,
} from "@beancount-js/beangulp";
import { connectorAccountSourceId } from "@beancount-js/beangulp";
import { StarlingNormalizer } from "./normalize";
import { discoverStarlingAccounts, StarlingSource } from "./source";
import { commitStarlingSyncState, prepareStarlingFetch } from "./sync";
import type { StarlingConfig, StarlingSyncState } from "./types";
import {
  DEFAULT_ALLOWED_HOSTS,
  DEFAULT_BASE_URL,
  DEFAULT_LOOKBACK_DAYS,
  STARLING_KIND,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function validateUrl(
  value: string,
  allowedHosts: readonly string[],
  label: string,
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  const local =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) {
    throw new Error(
      `${label} must use HTTPS (HTTP is allowed only for localhost).`,
    );
  }
  if (!allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new Error(`${label} is not in this source's allowlist.`);
  }
}

export function validateStarlingConfig(value: unknown): StarlingConfig {
  if (!isRecord(value)) throw new Error("Starling config must be an object.");
  const secretRef = optionalString(value.secretRef);
  if (!secretRef) {
    throw new Error("Starling needs an access token (or env: reference).");
  }
  if (secretRef.startsWith("env:") && !secretRef.slice(4).trim()) {
    throw new Error("Environment credential references need a variable name.");
  }
  const allowedHosts = Array.isArray(value.allowedHosts)
    ? value.allowedHosts
        .filter((host): host is string => typeof host === "string")
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean)
    : [...DEFAULT_ALLOWED_HOSTS];
  if (!allowedHosts.length) allowedHosts.push(...DEFAULT_ALLOWED_HOSTS);
  const baseUrl = optionalString(value.baseUrl) ?? DEFAULT_BASE_URL;
  validateUrl(baseUrl, allowedHosts, "Starling base URL");

  const syncStartDate = optionalString(value.syncStartDate);
  if (syncStartDate) {
    const parsed = DateTime.fromISO(syncStartDate, { zone: "utc" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(syncStartDate) || !parsed.isValid) {
      throw new Error(
        "syncStartDate must be an ISO calendar date (yyyy-MM-dd).",
      );
    }
    if (parsed.startOf("day") > DateTime.utc().startOf("day")) {
      throw new Error("syncStartDate cannot be in the future.");
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
  return {
    secretRef,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    allowedHosts,
    syncStartDate,
    lookbackDays,
  };
}

function defaultStarlingConfig(): StarlingConfig {
  return {
    secretRef: "env:STARLING_ACCESS_TOKEN",
    baseUrl: DEFAULT_BASE_URL,
    allowedHosts: [...DEFAULT_ALLOWED_HOSTS],
    lookbackDays: DEFAULT_LOOKBACK_DAYS,
  };
}

export const starlingConnector: ConnectorDefinition<
  StarlingConfig,
  StarlingSyncState
> = {
  kind: STARLING_KIND,
  name: "Starling Bank",
  description:
    "Import settled transactions from your Starling accounts using the public API.",
  catalog: {
    initials: "ST",
    accentClass: "bg-violet-700",
    region: "United Kingdom",
    category: "Bank",
    badge: "Beta",
  },
  capabilities: {
    groupedAccounts: true,
    discoverAccounts: true,
  },
  setupMarkdown: [
    "1. In the [Starling Developer Portal](https://developer.starlingbank.com/), link your account and create a personal access token with `account:read`, `account-list:read`, and `transaction:read`.",
    "2. Paste the token below, or store it as `STARLING_ACCESS_TOKEN` in the project `.env`, then save the connection.",
    "3. Open **Settings → Accounts** to load and link the Starling accounts you want to import.",
  ].join("\n"),
  connectionFields: [
    {
      id: "secretRef",
      label: "Access token",
      kind: "secret",
      path: "secretRef",
      placeholder: "env:STARLING_ACCESS_TOKEN",
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
  ],
  defaultConfig: defaultStarlingConfig,
  validateConfig: validateStarlingConfig,
  createSource() {
    return new StarlingSource();
  },
  createNormalizer() {
    return new StarlingNormalizer();
  },
  async discoverAccounts(
    config: StarlingConfig,
    context: SourceContext,
  ): Promise<DiscoveredConnectorAccount[]> {
    return discoverStarlingAccounts(config, context);
  },
  expandTargets(
    source: ConnectorSourceDefinition<StarlingConfig>,
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
  prepareFetch: prepareStarlingFetch,
  commitSyncState(args) {
    return commitStarlingSyncState({
      prepare: args.prepare,
      run: args.run,
      now: args.now,
    });
  },
};
