import { describe, expect, it } from "vitest";
import { createInMemorySource } from "./in-memory-source";
import {
  newLedgerChatSession,
  applyAgentEvent,
  readAgentEventStream,
  proposalForId,
} from "../../src/domain/lib/ai/chat";
describe("catalog assistant service", () => {
  it("streams a review proposal without writing and keeps it once with revision protection", async () => {
    const source = createInMemorySource();
    const path = "/api/projects/example/ai";
    const response = await source.request!(path, {
      method: "POST",
      body: JSON.stringify({ prompt: "Clarify the ledger title" }),
    });
    let session = newLedgerChatSession();
    await readAgentEventStream(response, (event) => {
      session = applyAgentEvent(session, event);
    });
    const item = session.items.find((item) => item.type === "proposal")!;
    if (item.type !== "proposal") throw new Error("Missing proposal");
    const before = await source.loadProject("example");
    expect(before.revisions[0]!.revision).toBe("1");
    const kept = await source.request!(
      `${path}/proposals/${item.proposal.id}`,
      { method: "PATCH", body: JSON.stringify({ action: "keep" }) },
    );
    const result = await kept.json();
    expect(proposalForId(result.session, item.proposal.id)?.status).toBe(
      "kept",
    );
    expect(result.snapshot.revisions[0].revision).toBe("2");
    expect(result.snapshot.ledgerFiles[0].contents).toContain(" · reviewed");
    expect(
      (
        await source.request!(`${path}/proposals/${item.proposal.id}`, {
          method: "PATCH",
          body: '{"action":"keep"}',
        })
      ).status,
    ).toBe(404);
  });
  it("undoes and clears without writing and rejects stale proposals", async () => {
    const source = createInMemorySource();
    const path = "/api/projects/example/ai";
    async function propose() {
      await (
        await source.request!(path, {
          method: "POST",
          body: '{"prompt":"Clarify title"}',
        })
      ).text();
      const { session } = await (await source.request!(path)).json();
      return session.items.findLast(
        (item: { type: string }) => item.type === "proposal",
      ).proposal;
    }
    let proposal = await propose();
    await source.request!(`${path}/proposals/${proposal.id}`, {
      method: "PATCH",
      body: '{"action":"undo"}',
    });
    expect((await source.loadProject("example")).revisions[0]!.revision).toBe(
      "1",
    );
    proposal = await propose();
    const project = await source.loadProject("example");
    await source.saveFile(
      "example",
      "main.beancount",
      project.ledgerFiles[0]!.contents + "\n",
      "1",
    );
    expect(
      (
        await source.request!(`${path}/proposals/${proposal.id}`, {
          method: "PATCH",
          body: '{"action":"keep"}',
        })
      ).status,
    ).toBe(409);
    expect(
      (await (await source.request!(path, { method: "DELETE" })).json()).session
        .items,
    ).toEqual([]);
    expect(
      (await (await createInMemorySource().request!(path)).json()).session
        .items,
    ).toEqual([]);
  });
});
