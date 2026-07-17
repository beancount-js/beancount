import { describe, expect, test } from "vitest";
import {
  duplicateIngestionSource,
  editableIngestionConfig,
  exampleIngestionConfig,
  newIngestionSource,
  parseEditableIngestionConfig,
  parseEditableIngestionYaml,
  serializeEditableIngestionConfig,
  serializeEditableIngestionYaml,
  sourceFromSample,
  validateEditableIngestionConfig,
} from "./source-form";
import { ingestionSamples } from "./samples";

describe("ingestion source form draft", () => {
  test("removes server-computed source properties without changing editable values", () => {
    const response = {
      version: 2 as const,
      accounts: ["Assets:Bank:Checking"],
      sources: [
        {
          ...exampleIngestionConfig.sources[0],
          credentialAvailable: true,
          merchantCredentialAvailable: false,
          allowedAccounts: ["Expenses:Food:Groceries"],
        },
      ],
    };

    const draft = editableIngestionConfig(response);
    expect(draft).toEqual(exampleIngestionConfig);
    expect(JSON.stringify(draft)).not.toContain("credentialAvailable");
    expect(JSON.stringify(draft)).not.toContain("allowedAccounts");
  });

  test("round-trips optional configuration and strips server-only JSON fields", () => {
    const raw = JSON.stringify({
      version: 2,
      sources: [
        {
          ...exampleIngestionConfig.sources[0],
          destinationPath: "imports.bean",
          credentialAvailable: true,
          allowedAccounts: ["Expenses:Food"],
        },
      ],
    });

    const parsed = parseEditableIngestionConfig(raw);
    expect(parsed.sources[0].destinationPath).toBe("imports.bean");
    expect("credentialAvailable" in parsed.sources[0]).toBe(false);
    expect("allowedAccounts" in parsed.sources[0]).toBe(false);
    expect(
      parseEditableIngestionConfig(serializeEditableIngestionConfig(parsed)),
    ).toEqual(parsed);
  });

  test("rejects JSON that is not an ingestion configuration root", () => {
    expect(() => parseEditableIngestionConfig("[]")).toThrow(
      "must be an object",
    );
    expect(() =>
      parseEditableIngestionConfig('{"version":3,"sources":[]}'),
    ).toThrow("version must be 1 or 2");
    expect(() => parseEditableIngestionConfig('{"version":1}')).toThrow(
      "sources must be an array",
    );
    expect(() =>
      parseEditableIngestionConfig('{"version":1,"sources":[{}]}'),
    ).toThrow("kind must be a string");
  });

  test("round-trips the YAML source editor through the same safe draft shape", () => {
    const yaml = serializeEditableIngestionYaml(exampleIngestionConfig);

    expect(yaml).toContain("sources:");
    expect(parseEditableIngestionYaml(yaml)).toEqual(exampleIngestionConfig);
    expect(() => parseEditableIngestionYaml("sources: [")).toThrow(
      "Invalid YAML",
    );
    expect(() => parseEditableIngestionYaml("version: 3\nsources: []")).toThrow(
      "version must be 1 or 2",
    );
  });

  test("creates a unique source and duplicates without sharing draft state", () => {
    const first = newIngestionSource([]);
    const second = newIngestionSource([first]);
    const copy = duplicateIngestionSource(exampleIngestionConfig.sources[0], [
      ...exampleIngestionConfig.sources,
      first,
      second,
    ]);

    expect(first.id).toBe("source");
    expect(second.id).toBe("source-2");
    expect(copy.id).not.toBe(exampleIngestionConfig.sources[0].id);
    expect(copy.name).toBe("My bank copy");
    copy.api!.endpoint = "https://changed.example.test";
    expect(exampleIngestionConfig.sources[0].api!.endpoint).toBe(
      "https://api.example.com/transactions",
    );
  });

  test("keeps sample template ids when connecting unless already taken", () => {
    const lunchflow = ingestionSamples.find(
      (sample) => sample.id === "lunchflow",
    );
    expect(lunchflow).toBeDefined();
    const connected = sourceFromSample(lunchflow!.template, []);
    expect(connected.id).toBe("lunchflow");
    expect(connected.kind).toBe("lunchflow");
    expect((connected.config as { baseUrl?: string }).baseUrl).toBe(
      "https://www.lunchflow.app/api/v1",
    );
    expect((connected.config as { secretRef?: string }).secretRef).toBe(
      "env:LUNCHFLOW_API_KEY",
    );
    expect(connected.merchantEnrichment?.brandfetch).toBeUndefined();
    expect(connected.accounts).toEqual([]);

    const conflict = sourceFromSample(lunchflow!.template, [connected]);
    expect(conflict.id).toBe("source");
  });

  test("provides a secure Starling connection template", () => {
    const starling = ingestionSamples.find(
      (sample) => sample.id === "starling",
    );
    expect(starling).toMatchObject({
      name: "Starling Bank",
      initials: "ST",
      accentClass: "bg-violet-700",
      region: "United Kingdom",
      category: "Bank",
      badge: "Beta",
    });
    expect(starling?.template).toMatchObject({
      id: "starling",
      kind: "starling",
      accounts: [],
      config: {
        secretRef: "env:STARLING_ACCESS_TOKEN",
        baseUrl: "https://api.starlingbank.com",
        allowedHosts: ["api.starlingbank.com", "api-sandbox.starlingbank.com"],
        lookbackDays: 7,
      },
    });
  });

  test("validates grouped connections separately from standalone sources", () => {
    const lunchflow = ingestionSamples.find(
      (sample) => sample.id === "lunchflow",
    )!;
    const draft = {
      version: 2 as const,
      sources: [
        {
          ...structuredClone(lunchflow.template),
          accounts: [
            {
              id: "42",
              name: "Current",
              sourceAccount: "Assets:Bank:Current",
            },
          ],
        },
      ],
    };
    expect(validateEditableIngestionConfig(draft)).toEqual([]);

    draft.sources[0].accounts = [];
    expect(validateEditableIngestionConfig(draft)).toEqual([]);
  });

  test("reports client-side constraints before the server save boundary", () => {
    expect(validateEditableIngestionConfig(exampleIngestionConfig)).toEqual([]);

    const invalid = structuredClone(exampleIngestionConfig);
    invalid.sources[0].id = "bad identifier";
    invalid.sources[0].api!.endpoint = "http://api.example.test/transactions";
    invalid.sources[0].api!.secretRef = "";
    invalid.sources.push({ ...structuredClone(invalid.sources[0]) });

    const issues = validateEditableIngestionConfig(invalid);
    expect(issues.map((issue) => issue.fieldId)).toEqual(
      expect.arrayContaining(["id", "api.endpoint", "api.secretRef"]),
    );
    expect(issues.some((issue) => issue.message.includes("unique"))).toBe(true);
  });
});
