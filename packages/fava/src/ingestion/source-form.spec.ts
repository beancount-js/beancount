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
  validateEditableIngestionConfig,
} from "./source-form";

describe("ingestion source form draft", () => {
  test("removes server-computed source properties without changing editable values", () => {
    const response = {
      version: 1 as const,
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
      version: 1,
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
      parseEditableIngestionConfig('{"version":2,"sources":[]}'),
    ).toThrow("version must be 1");
    expect(() => parseEditableIngestionConfig('{"version":1}')).toThrow(
      "sources must be an array",
    );
    expect(() =>
      parseEditableIngestionConfig('{"version":1,"sources":[{}]}'),
    ).toThrow("kind must be json-api");
  });

  test("round-trips the YAML source editor through the same safe draft shape", () => {
    const yaml = serializeEditableIngestionYaml(exampleIngestionConfig);

    expect(yaml).toContain("sources:");
    expect(parseEditableIngestionYaml(yaml)).toEqual(exampleIngestionConfig);
    expect(() => parseEditableIngestionYaml("sources: [")).toThrow(
      "Invalid YAML",
    );
    expect(() => parseEditableIngestionYaml("version: 2\nsources: []")).toThrow(
      "version must be 1",
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
    copy.api.endpoint = "https://changed.example.test";
    expect(exampleIngestionConfig.sources[0].api.endpoint).toBe(
      "https://api.example.com/transactions",
    );
  });

  test("reports client-side constraints before the server save boundary", () => {
    expect(validateEditableIngestionConfig(exampleIngestionConfig)).toEqual([]);

    const invalid = structuredClone(exampleIngestionConfig);
    invalid.sources[0].id = "bad identifier";
    invalid.sources[0].api.endpoint = "http://api.example.test/transactions";
    invalid.sources[0].api.secretRef = "plain-token";
    invalid.sources.push({ ...structuredClone(invalid.sources[0]) });

    const issues = validateEditableIngestionConfig(invalid);
    expect(issues.map((issue) => issue.fieldId)).toEqual(
      expect.arrayContaining(["id", "api.endpoint", "api.secretRef"]),
    );
    expect(issues.some((issue) => issue.message.includes("unique"))).toBe(true);
  });
});
