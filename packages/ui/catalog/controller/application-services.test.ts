import { describe, expect, it } from "vitest";
import { createInMemorySource } from "./in-memory-source";
import type { IngestionRun } from "@beancount-js/beangulp";
function client() {
  const source = createInMemorySource();
  async function json(path: string, method = "GET", body?: unknown) {
    const response = await source.request!(`/api/projects/example/${path}`, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { response, value: await response.json() };
  }
  return { source, json };
}
describe("catalog application services", () => {
  it("accepts a ready import once, with revision protection and a balanced ledger write", async () => {
    const { source, json } = client();
    const project = await source.loadProject(
      "example",
      new AbortController().signal,
    );
    const revision = project.revisions.find(
      (r) => r.path === "main.beancount",
    )!.revision;
    const rejected = await json("ingestion/runs/import-2024/accept", "POST", {
      proposalIds: ["proposal-books"],
      expectedRevision: revision,
    });
    expect(rejected.response.status).toBe(400);
    const accepted = await json("ingestion/runs/import-2024/accept", "POST", {
      proposalIds: ["proposal-coffee"],
      expectedRevision: revision,
    });
    expect(accepted.response.ok).toBe(true);
    expect(accepted.value.run.summary.accepted).toBe(1);
    expect(accepted.value.snapshot.ledgerFiles[0].contents).toContain(
      'import_id: "fixture-coffee"',
    );
    expect(accepted.value.snapshot.ledgerFiles[0].contents).toContain(
      "Expenses:Food 20 GBP",
    );
    expect(
      (
        await json("ingestion/runs/import-2024/accept", "POST", {
          proposalIds: ["proposal-coffee"],
          expectedRevision: revision,
        })
      ).response.status,
    ).toBe(400);
  });
  it("previews rules without mutating imports and isolates project services", async () => {
    const { json } = client();
    const before = (await json("ingestion/runs/import-2024"))
      .value as IngestionRun;
    const preview = (
      await json("rules/apply", "POST", {
        dryRun: true,
        target: "pending-imports",
      })
    ).value;
    expect(preview.preview[0].pendingImports).toBe(1);
    expect((await json("ingestion/runs/import-2024")).value).toEqual(before);
    expect(
      (await json("rules/apply", "POST", { target: "pending-imports" })).value
        .results[0].modified,
    ).toBe(1);
    await json("ingestion/merchants/merchant-example-cafe", "PATCH", {
      canonicalName: "Renamed cafe",
    });
    expect((await json("ingestion/merchants")).value[0].canonicalName).toBe(
      "Renamed cafe",
    );
    expect(
      (await client().json("ingestion/merchants")).value[0].canonicalName,
    ).toBe("Example cafe");
  });
  it("persists reconciliation decisions before applying them and streams sync completion", async () => {
    const { json, source } = client();
    const decision = await json("ingestion/reconciliation", "PUT", {
      candidateId: "candidate-transfer",
      state: "confirmed",
    });
    expect(decision.value.candidates[0].decision.state).toBe("confirmed");
    await json("ingestion/reconciliation/candidate-transfer/apply", "POST");
    expect((await json("ingestion/reconciliation")).value.candidates).toEqual(
      [],
    );
    const job = (await json("ingestion/sync", "POST", { sourceId: "bank" }))
      .value.job;
    const stream = await source.request!(
      `/api/projects/example/ingestion/sync/${job.id}/events`,
    );
    const events = (await stream.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(events.at(-1).job.status).toBe("completed");
  });
});
