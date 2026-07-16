import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Document, Open } from "../core/data";
import type { DocumentStore } from "../parser/loader";
import {
  findDocuments,
  processDocuments,
  verifyDocumentFilesExist,
} from "./documents";

const paths = [
  "documents/Assets/US/Bank/Checking/2014-06-08.statement.pdf",
  "documents/Assets/US/Bank/Checking/other.txt",
  "documents/Assets/US/Bank/Savings/2014-07-01.statement.pdf",
  "documents/Liabilities/US/Bank/2014-02-31.invalid.pdf",
];
const store: DocumentStore = {
  list() {
    return paths.map((path) => ({ path }));
  },
  exists(path) {
    return paths.includes(path);
  },
};

describe("document operations", () => {
  test("discovers dated documents and maps their directories to accounts", () => {
    const [documents, errors] = findDocuments(store, "documents", "main.bean");

    expect(
      documents.map((document) => [
        document.account,
        document.date.toISODate(),
      ]),
    ).toEqual([
      ["Assets:US:Bank:Checking", "2014-06-08"],
      ["Assets:US:Bank:Savings", "2014-07-01"],
    ]);
    expect(errors[0].message).toContain("Invalid date on document file");
  });

  test("restricts generated documents to opened accounts and validates paths", () => {
    const entries = [
      new Open(DateTime.fromISO("2014-01-01"), "Assets:US:Bank:Checking"),
      new Document(
        DateTime.fromISO("2014-07-10"),
        "Assets:US:Bank:Checking",
        "documents/missing.pdf",
      ),
    ];
    const [processed] = processDocuments(
      entries,
      store,
      ["documents"],
      "main.bean",
    );
    const [unchanged, errors] = verifyDocumentFilesExist(processed, store);

    expect(unchanged.filter((entry) => entry instanceof Document)).toHaveLength(
      2,
    );
    expect(errors.map((error) => error.message)).toEqual([
      'File does not exist: "documents/missing.pdf"',
    ]);
  });

  test("reports strict parent and child account mismatches", () => {
    const [, errors] = findDocuments(
      store,
      "documents",
      "main.bean",
      new Set(["Assets:US:Bank"]),
      true,
    );

    expect(errors.map((error) => error.message)).toContain(
      "Document found in child account Assets:US:Bank:Checking",
    );
  });
});
