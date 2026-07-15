import { describe, expect, test } from "vitest";
import {
  applyAgentEvent,
  newLedgerChatSession,
  proposalFromAgentEvent,
} from "./chat";

describe("ledger chat trace", () => {
  test("keeps streamed output once when the completed item repeats it", () => {
    let session = newLedgerChatSession();
    session = applyAgentEvent(session, {
      type: "output_delta",
      text: "Ledger is balanced.",
    });
    session = applyAgentEvent(session, {
      type: "message",
      text: "Ledger is balanced.",
    });
    expect(session.messages).toEqual([
      { role: "assistant", text: "Ledger is balanced." },
    ]);
    expect(
      session.items.filter((item) => item.type === "message"),
    ).toHaveLength(1);
  });

  test("extracts a ledger proposal from structured MCP output", () => {
    const proposal = proposalFromAgentEvent({
      type: "tool_call_completed",
      id: "tool-1",
      name: "ledger_propose_change",
      result: {
        structuredContent: {
          id: "proposal-1",
          kind: "ledger",
          title: "Use EUR",
          file: { path: "main.bean", revision: "revision" },
          replacements: [{ oldText: "USD", newText: "EUR" }],
          valid: true,
        },
      },
    });
    expect(proposal?.id).toBe("proposal-1");
  });
});
