import { describe, expect, test } from "vitest";
import { codexAppServerArgs } from "./codex";
import { mapCodexNotification } from "./codex-protocol";

describe("Codex account assistant", () => {
  test("starts Codex with its restricted read-only profile", () => {
    const args = codexAppServerArgs().join(" ");
    expect(args).toContain("app-server");
    expect(args).toContain('sandbox_mode="read-only"');
    expect(args).toContain('approval_policy="never"');
    expect(args).toContain("features.shell_tool=false");
    expect(args).toContain('web_search="disabled"');
  });

  test("maps app-server errors and emits agent text only from deltas", () => {
    expect(
      mapCodexNotification({
        method: "item/agentMessage/delta",
        params: { itemId: "item-1", delta: "streamed answer" },
      }),
    ).toEqual([
      {
        type: "output_delta",
        itemId: "item-1",
        text: "streamed answer",
        turnId: undefined,
      },
    ]);
    expect(
      mapCodexNotification({
        method: "error",
        params: { message: "The selected model is unavailable." },
      }),
    ).toEqual([
      {
        type: "error",
        message: "The selected model is unavailable.",
        error: { message: "The selected model is unavailable." },
      },
    ]);
  });
});
