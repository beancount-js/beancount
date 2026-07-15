import type { FormValidationIssue } from "@beancount-js/forms";
import type { IngestionConfigResponse, IngestionSource } from "./types";
import { parse, stringify } from "yaml";

export type EditableIngestionSource = Omit<
  IngestionSource,
  "credentialAvailable" | "merchantCredentialAvailable" | "allowedAccounts"
>;

export type EditableIngestionConfig = {
  version: 1;
  sources: EditableIngestionSource[];
};

export const exampleIngestionConfig: EditableIngestionConfig = {
  version: 1,
  sources: [
    {
      id: "bank",
      name: "My bank",
      kind: "json-api",
      sourceAccount: "Assets:Bank:Checking",
      defaultCurrency: "GBP",
      aiEnabled: false,
      merchantEnrichment: {
        enabled: true,
        aiEnabled: false,
        countryCode: "GB",
        brandfetch: {
          enabled: false,
          apiKeySecretRef: "env:BRANDFETCH_API_KEY",
          assetMode: "hotlink",
        },
      },
      api: {
        endpoint: "https://api.example.com/transactions",
        allowedHosts: ["api.example.com"],
        secretRef: "env:BANK_API_TOKEN",
        recordsPath: "transactions",
        pagination: {
          cursorQueryParam: "cursor",
          nextCursorPath: "next_cursor",
        },
      },
      mapping: {
        id: "id",
        date: "booked_at",
        amount: "amount.value",
        currency: "amount.currency",
        merchant: "merchant.name",
        narration: "description",
        status: "status",
      },
      rules: [{ merchant: "Tesco", account: "Expenses:Food:Groceries" }],
    },
  ],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

/** Remove server-computed source fields before storing a user-editable draft. */
export function editableIngestionConfig(
  response: IngestionConfigResponse,
): EditableIngestionConfig {
  return clone({
    version: response.version,
    sources: response.sources.map(
      ({
        credentialAvailable: _credentialAvailable,
        merchantCredentialAvailable: _merchantCredentialAvailable,
        allowedAccounts: _allowedAccounts,
        ...source
      }) => source,
    ),
  });
}

/**
 * Parse the shape needed to safely return from Source mode. Deeper validation
 * stays server-authoritative, while the structured form keeps user-friendly
 * feedback for values that are present but incomplete.
 */
export function parseEditableIngestionConfig(
  value: string,
): EditableIngestionConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid JSON: ${error.message}`
        : "Invalid JSON.",
    );
  }

  const root = asRecord(parsed, "Source configuration");
  if (root.version !== 1) {
    throw new Error("Source configuration version must be 1.");
  }
  if (!Array.isArray(root.sources)) {
    throw new Error("Source configuration sources must be an array.");
  }

  return clone({
    version: 1,
    sources: root.sources.map((source, index) => {
      const item = asRecord(source, `Source ${index + 1}`);
      if (item.kind !== "json-api") {
        throw new Error(`Source ${index + 1} kind must be json-api.`);
      }
      for (const key of ["id", "name", "sourceAccount"]) {
        if (typeof item[key] !== "string") {
          throw new Error(`Source ${index + 1} ${key} must be a string.`);
        }
      }
      const api = asRecord(item.api, `Source ${index + 1} api`);
      for (const key of ["endpoint", "secretRef"]) {
        if (typeof api[key] !== "string") {
          throw new Error(`Source ${index + 1} api.${key} must be a string.`);
        }
      }
      const mapping = asRecord(item.mapping, `Source ${index + 1} mapping`);
      for (const key of ["date", "amount"]) {
        if (typeof mapping[key] !== "string") {
          throw new Error(
            `Source ${index + 1} mapping.${key} must be a string.`,
          );
        }
      }
      if (!Array.isArray(item.rules)) {
        throw new Error(`Source ${index + 1} rules must be an array.`);
      }
      const {
        credentialAvailable: _credentialAvailable,
        merchantCredentialAvailable: _merchantCredentialAvailable,
        allowedAccounts: _allowedAccounts,
        ...editable
      } = item;
      return editable as EditableIngestionSource;
    }),
  });
}

export function serializeEditableIngestionConfig(
  config: EditableIngestionConfig,
) {
  return JSON.stringify(config, null, 2);
}

/**
 * Serialize the local draft for the CV-style source editor. Persistence stays
 * JSON.
 */
export function serializeEditableIngestionYaml(
  config: EditableIngestionConfig,
) {
  return stringify(clone(config), { lineWidth: 0 });
}

/**
 * YAML source mode is an editing representation of the same JSON payload sent
 * to the ingestion API. Reusing the JSON shape validator keeps both editors
 * aligned and strips all server-computed fields before a draft can be saved.
 */
export function parseEditableIngestionYaml(
  value: string,
): EditableIngestionConfig {
  let parsed: unknown;
  try {
    parsed = parse(value);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid YAML: ${error.message}`
        : "Invalid YAML.",
    );
  }

  return parseEditableIngestionConfig(JSON.stringify(parsed));
}

function isLocalHttp(url: URL) {
  return (
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  );
}

function sourceIssues(
  source: EditableIngestionSource,
  sourceIndex: number,
): FormValidationIssue[] {
  const field = (id: string, message: string): FormValidationIssue => ({
    fieldId: id,
    path: `sources.${sourceIndex}.${id}`,
    message,
    severity: "error",
  });
  const issues: FormValidationIssue[] = [];

  if (!source.id?.trim())
    issues.push(field("id", "A source identifier is required."));
  else if (!/^[a-zA-Z0-9_-]+$/.test(source.id)) {
    issues.push(
      field("id", "Use letters, numbers, hyphens, and underscores only."),
    );
  }
  if (!source.name?.trim())
    issues.push(field("name", "A source name is required."));
  if (!source.sourceAccount?.trim()) {
    issues.push(field("sourceAccount", "A source account is required."));
  }
  if (!source.api?.endpoint?.trim()) {
    issues.push(field("api.endpoint", "An API endpoint is required."));
  } else {
    try {
      const endpoint = new URL(source.api.endpoint);
      if (endpoint.protocol !== "https:" && !isLocalHttp(endpoint)) {
        issues.push(
          field("api.endpoint", "Use HTTPS, except for localhost development."),
        );
      }
      if (
        source.api.allowedHosts?.length &&
        !source.api.allowedHosts.some(
          (host) =>
            host.trim().toLowerCase() === endpoint.hostname.toLowerCase(),
        )
      ) {
        issues.push(
          field(
            "api.allowedHosts",
            "The endpoint host must be in the allowlist.",
          ),
        );
      }
    } catch {
      issues.push(field("api.endpoint", "Enter a valid API URL."));
    }
  }
  if (!source.api?.secretRef?.startsWith("env:")) {
    issues.push(
      field(
        "api.secretRef",
        "Use an environment secret reference such as env:BANK_API_TOKEN.",
      ),
    );
  }
  if (!source.mapping?.date?.trim()) {
    issues.push(field("mapping.date", "A date mapping is required."));
  }
  if (!source.mapping?.amount?.trim()) {
    issues.push(field("mapping.amount", "An amount mapping is required."));
  }

  const enrichment = source.merchantEnrichment;
  if (enrichment?.countryCode && !/^[A-Z]{2}$/i.test(enrichment.countryCode)) {
    issues.push(
      field(
        "merchantEnrichment.countryCode",
        "Use a two-letter ISO country code.",
      ),
    );
  }
  const brandfetch = enrichment?.brandfetch;
  if (brandfetch?.enabled && !brandfetch.apiKeySecretRef?.startsWith("env:")) {
    issues.push(
      field(
        "merchantEnrichment.brandfetch.apiKeySecretRef",
        "Brandfetch needs an env: API key reference.",
      ),
    );
  }
  if (brandfetch?.assetMode === "cache" && !brandfetch.cacheContentAllowed) {
    issues.push(
      field(
        "merchantEnrichment.brandfetch.cacheContentAllowed",
        "Confirm content caching before using the cache asset mode.",
      ),
    );
  }
  if (brandfetch?.allowTransactionLookup && !enrichment?.countryCode?.trim()) {
    issues.push(
      field(
        "merchantEnrichment.countryCode",
        "Transaction lookup needs a country code.",
      ),
    );
  }
  if (
    brandfetch?.ttlDays !== undefined &&
    (!Number.isInteger(brandfetch.ttlDays) ||
      brandfetch.ttlDays < 1 ||
      brandfetch.ttlDays > 29)
  ) {
    issues.push(
      field(
        "merchantEnrichment.brandfetch.ttlDays",
        "Cache TTL must be a whole number from 1 to 29.",
      ),
    );
  }
  return issues;
}

export function validateEditableIngestionConfig(
  config: EditableIngestionConfig,
): FormValidationIssue[] {
  const issues = config.sources.flatMap(sourceIssues);
  const seen = new Set<string>();
  config.sources.forEach((source, index) => {
    const id = source.id?.trim();
    if (!id || !seen.has(id)) {
      if (id) seen.add(id);
      return;
    }
    issues.push({
      fieldId: "id",
      path: `sources.${index}.id`,
      message: "Source identifiers must be unique.",
      severity: "error",
    });
  });
  return issues;
}

export function sourceIdForNewSource(
  sources: readonly EditableIngestionSource[],
) {
  const ids = new Set(sources.map((source) => source.id));
  if (!ids.has("source")) return "source";
  let suffix = 2;
  while (ids.has(`source-${suffix}`)) suffix += 1;
  return `source-${suffix}`;
}

export function newIngestionSource(
  sources: readonly EditableIngestionSource[],
): EditableIngestionSource {
  return {
    id: sourceIdForNewSource(sources),
    name: "New source",
    kind: "json-api",
    sourceAccount: "",
    api: { endpoint: "", secretRef: "env:" },
    mapping: { date: "", amount: "" },
    rules: [],
  };
}

export function duplicateIngestionSource(
  source: EditableIngestionSource,
  sources: readonly EditableIngestionSource[],
): EditableIngestionSource {
  const copy = clone(source);
  copy.id = sourceIdForNewSource([...sources, copy]);
  copy.name = `${source.name} copy`;
  return copy;
}
