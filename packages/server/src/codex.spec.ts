import { describe, expect, test } from "vitest";
import { codexAppServerArgs } from "./codex";

describe("Codex account assistant", () => {
  test("starts Codex with its restricted read-only profile", () => {
    const args = codexAppServerArgs().join(" ");
    expect(args).toContain("app-server");
    expect(args).toContain('sandbox_mode="read-only"');
    expect(args).toContain('approval_policy="never"');
    expect(args).toContain("features.shell_tool=false");
    expect(args).toContain('web_search="disabled"');
  });
});
