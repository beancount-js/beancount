import type { FormValidationIssue } from "@beancount-js/forms";
import type {
  BrandfetchEnrichmentConfig,
  IngestionConfigResponse,
  IngestionReconciliationConfig,
  IngestionSource,
} from "./types";
import { isEnvSecretNameValid, isSecretConfigured } from "./secret-ref";
import {
  isConnectorSource,
  isGroupedSource,
  sourceSecretRef,
} from "./connectors";
import { parse, stringify } from "yaml";

export type EditableIngestionSource = Omit<
  IngestionSource,
  "credentialAvailable" | "merchantCredentialAvailable" | "allowedAccounts"
>;

export type EditableIngestionConfig = {
  version: 1 | 2 | 3;
  brandfetch?: BrandfetchEnrichmentConfig;
  reconciliation?: IngestionReconciliationConfig;
  sources: EditableIngestionSource[];
};

export const exampleIngestionConfig: EditableIngestionConfig = {
  version: 3,
  sources: [
    {
      id: "bank",
      name: "My bank",
      kind: "json-api",
      merchantId: "",
      sourceAccount: "Assets:Bank:Checking",
      defaultCurrency: "GBP",
      aiEnabled: false,
      setup: [
        "1. Go to [api.example.com](https://api.example.com) and create an API key.",
        "2. Paste the API key below (or switch to Environment and enter a variable name) and connect.",
        "3. Then head to Review imports to fetch and categorise.",
      ].join("\n"),
      merchantEnrichment: {
        enabled: true,
        aiEnabled: false,
        countryCode: "GB",
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
      rules: [],
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
    brandfetch: response.brandfetch,
    reconciliation: response.reconciliation,
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
  if (root.version !== 1 && root.version !== 2 && root.version !== 3) {
    throw new Error("Source configuration version must be 1, 2, or 3.");
  }
  if (!Array.isArray(root.sources)) {
    throw new Error("Source configuration sources must be an array.");
  }

  return clone({
    version: root.version as 1 | 2 | 3,
    brandfetch: root.brandfetch as BrandfetchEnrichmentConfig | undefined,
    reconciliation: root.reconciliation as
      | IngestionReconciliationConfig
      | undefined,
    sources: root.sources.map((source, index) => {
      const item = asRecord(source, `Source ${index + 1}`);
      if (typeof item.kind !== "string" || !item.kind.trim()) {
        throw new Error(`Source ${index + 1} kind must be a string.`);
      }
      for (const key of ["id", "name"]) {
        if (typeof item[key] !== "string") {
          throw new Error(`Source ${index + 1} ${key} must be a string.`);
        }
      }
      if (
        item.merchantId !== undefined &&
        typeof item.merchantId !== "string"
      ) {
        throw new Error(`Source ${index + 1} merchantId must be a string.`);
      }
      const connector = item.kind !== "json-api";
      const grouped = Array.isArray(item.accounts);
      if (!connector && !grouped && typeof item.sourceAccount !== "string") {
        throw new Error(`Source ${index + 1} sourceAccount must be a string.`);
      }
      if (connector) {
        if (!item.config || typeof item.config !== "object") {
          throw new Error(`Source ${index + 1} config must be an object.`);
        }
      } else {
        const api = asRecord(item.api, `Source ${index + 1} api`);
        if (typeof api.secretRef !== "string") {
          throw new Error(
            `Source ${index + 1} api.secretRef must be a string.`,
          );
        }
        if (grouped) {
          if (typeof api.baseUrl !== "string") {
            throw new Error(
              `Source ${index + 1} api.baseUrl must be a string.`,
            );
          }
        } else if (typeof api.endpoint !== "string") {
          throw new Error(`Source ${index + 1} api.endpoint must be a string.`);
        }
        const mapping = asRecord(item.mapping, `Source ${index + 1} mapping`);
        for (const key of ["date", "amount"]) {
          if (typeof mapping[key] !== "string") {
            throw new Error(
              `Source ${index + 1} mapping.${key} must be a string.`,
            );
          }
        }
      }
      if (!Array.isArray(item.rules)) {
        throw new Error(`Source ${index + 1} rules must be an array.`);
      }
      if (grouped) {
        for (const [accountIndex, account] of (
          item.accounts as unknown[]
        ).entries()) {
          const row = asRecord(
            account,
            `Source ${index + 1} account ${accountIndex + 1}`,
          );
          for (const key of ["id", "name", "sourceAccount"]) {
            if (typeof row[key] !== "string") {
              throw new Error(
                `Source ${index + 1} account ${accountIndex + 1} ${key} must be a string.`,
              );
            }
          }
        }
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

function validateUrlField(
  value: string,
  allowedHosts: readonly string[] | undefined,
  fieldId: string,
  sourceIndex: number,
  issues: FormValidationIssue[],
) {
  const field = (id: string, message: string): FormValidationIssue => ({
    fieldId: id,
    path: `sources.${sourceIndex}.${id}`,
    message,
    severity: "error",
  });
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && !isLocalHttp(url)) {
      issues.push(
        field(fieldId, "Use HTTPS, except for localhost development."),
      );
    }
    if (
      allowedHosts?.length &&
      !allowedHosts.some(
        (host) => host.trim().toLowerCase() === url.hostname.toLowerCase(),
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
    issues.push(field(fieldId, "Enter a valid API URL."));
  }
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
  const connector = isConnectorSource(source);
  const grouped = isGroupedSource(source);

  if (!source.id?.trim())
    issues.push(field("id", "A source identifier is required."));
  else if (!/^[a-zA-Z0-9_-]+$/.test(source.id)) {
    issues.push(
      field("id", "Use letters, numbers, hyphens, and underscores only."),
    );
  }
  if (!source.name?.trim())
    issues.push(field("name", "A source name is required."));
  if (
    source.reconciliationPriority !== undefined &&
    (!Number.isInteger(source.reconciliationPriority) ||
      source.reconciliationPriority < -100 ||
      source.reconciliationPriority > 100)
  ) {
    issues.push(
      field("reconciliationPriority", "Use an integer from -100 to 100."),
    );
  }

  if (grouped) {
    if (connector) {
      const baseUrl = (source.config as { baseUrl?: string } | undefined)
        ?.baseUrl;
      if (!baseUrl?.trim()) {
        issues.push(field("config.baseUrl", "A base API URL is required."));
      } else {
        validateUrlField(
          baseUrl,
          (source.config as { allowedHosts?: string[] } | undefined)
            ?.allowedHosts,
          "config.baseUrl",
          sourceIndex,
          issues,
        );
      }
    } else if (!source.api?.baseUrl?.trim()) {
      issues.push(field("api.baseUrl", "A base API URL is required."));
    } else {
      validateUrlField(
        source.api.baseUrl,
        source.api.allowedHosts,
        "api.baseUrl",
        sourceIndex,
        issues,
      );
    }
    if (source.accounts?.length) {
      const seen = new Set<string>();
      source.accounts.forEach((account, accountIndex) => {
        const prefix = `accounts.${accountIndex}`;
        if (!account.id?.trim()) {
          issues.push(field(`${prefix}.id`, "An account id is required."));
        } else if (!/^[a-zA-Z0-9_-]+$/.test(account.id)) {
          issues.push(
            field(
              `${prefix}.id`,
              "Use letters, numbers, hyphens, and underscores only.",
            ),
          );
        } else if (seen.has(account.id)) {
          issues.push(
            field(`${prefix}.id`, "Linked account identifiers must be unique."),
          );
        } else {
          seen.add(account.id);
        }
        if (!account.name?.trim()) {
          issues.push(field(`${prefix}.name`, "An account name is required."));
        }
        if (!account.sourceAccount?.trim()) {
          issues.push(
            field(
              `${prefix}.sourceAccount`,
              "A Beancount source account is required.",
            ),
          );
        }
        if (
          account.reconciliationPriority !== undefined &&
          (!Number.isInteger(account.reconciliationPriority) ||
            account.reconciliationPriority < -100 ||
            account.reconciliationPriority > 100)
        ) {
          issues.push(
            field(
              `${prefix}.reconciliationPriority`,
              "Use an integer from -100 to 100.",
            ),
          );
        }
      });
    }
  } else if (!connector) {
    if (!source.sourceAccount?.trim()) {
      issues.push(field("sourceAccount", "A source account is required."));
    }
    if (!source.api?.endpoint?.trim()) {
      issues.push(field("api.endpoint", "An API endpoint is required."));
    } else {
      validateUrlField(
        source.api.endpoint,
        source.api.allowedHosts,
        "api.endpoint",
        sourceIndex,
        issues,
      );
    }
  }

  const secretRef = sourceSecretRef(source);
  const secretFieldId = connector ? "config.secretRef" : "api.secretRef";
  if (!isSecretConfigured(secretRef)) {
    issues.push(
      field(secretFieldId, "Enter an API key or environment variable name."),
    );
  } else if (!isEnvSecretNameValid(secretRef!)) {
    issues.push(
      field(
        secretFieldId,
        "Environment variable names may use letters, numbers, and underscores.",
      ),
    );
  }
  if (!connector) {
    if (!source.mapping?.date?.trim()) {
      issues.push(field("mapping.date", "A date mapping is required."));
    }
    if (!source.mapping?.amount?.trim()) {
      issues.push(field("mapping.amount", "An amount mapping is required."));
    }
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
  return issues;
}

function brandfetchIssues(
  brandfetch: BrandfetchEnrichmentConfig | undefined,
): FormValidationIssue[] {
  if (!brandfetch) return [];
  const field = (id: string, message: string): FormValidationIssue => ({
    fieldId: id,
    path: id,
    message,
    severity: "error",
  });
  const issues: FormValidationIssue[] = [];
  if (brandfetch.enabled) {
    const clientId = brandfetch.clientId;
    if (!isSecretConfigured(clientId)) {
      issues.push(
        field(
          "brandfetch.clientId",
          "Enter a Brandfetch Logo API client ID or environment variable name.",
        ),
      );
    } else if (!isEnvSecretNameValid(clientId!)) {
      issues.push(
        field(
          "brandfetch.clientId",
          "Environment variable names may use letters, numbers, and underscores.",
        ),
      );
    }
  }
  const cacheUserAgent = brandfetch.cacheUserAgent?.trim();
  if (
    cacheUserAgent &&
    (cacheUserAgent.length > 512 || /[\r\n]/.test(cacheUserAgent))
  ) {
    issues.push(
      field(
        "brandfetch.cacheUserAgent",
        "Use at most 512 characters without line breaks.",
      ),
    );
  }
  return issues;
}

function reconciliationIssues(
  reconciliation: IngestionReconciliationConfig | undefined,
): FormValidationIssue[] {
  if (!reconciliation) return [];
  const issue = (fieldId: string, message: string): FormValidationIssue => ({
    fieldId,
    path: `reconciliation.${fieldId}`,
    message,
    severity: "error",
  });
  const issues: FormValidationIssue[] = [];
  for (const field of ["duplicateWindowDays", "transferWindowDays"] as const) {
    const value = reconciliation[field];
    if (
      value !== undefined &&
      (!Number.isInteger(value) || value < 0 || value > 31)
    ) {
      issues.push(issue(field, "Use a whole number from 0 to 31."));
    }
  }
  const tolerance = reconciliation.fxRateTolerance;
  if (
    tolerance !== undefined &&
    (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 1)
  ) {
    issues.push(issue("fxRateTolerance", "Use a decimal from 0 to 1."));
  }
  return issues;
}

export function validateEditableIngestionConfig(
  config: EditableIngestionConfig,
): FormValidationIssue[] {
  const issues = [
    ...config.sources.flatMap(sourceIssues),
    ...brandfetchIssues(config.brandfetch),
    ...reconciliationIssues(config.reconciliation),
  ];
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
    merchantId: "",
    sourceAccount: "",
    api: { endpoint: "", secretRef: "" },
    mapping: { date: "", amount: "" },
    rules: [],
  };
}

export function sourceFromSample(
  template: EditableIngestionSource,
  sources: readonly EditableIngestionSource[],
): EditableIngestionSource {
  const copy = clone(template);
  const taken = new Set(sources.map((source) => source.id));
  if (!copy.id || taken.has(copy.id)) {
    copy.id = sourceIdForNewSource(sources);
  }
  return copy;
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
