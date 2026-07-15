import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  projectAiSessionsRoot,
  projectIngestionRoot,
  studioConfigRoot,
} from "./paths";

const previous = process.env.XDG_CONFIG_HOME;

afterEach(() => {
  if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = previous;
});

describe("studioConfigRoot", () => {
  test("appends beancount-js under XDG_CONFIG_HOME", () => {
    process.env.XDG_CONFIG_HOME = "/tmp/xdg-config";
    expect(studioConfigRoot()).toBe(join("/tmp/xdg-config", "beancount-js"));
  });

  test("falls back to ~/.config/beancount-js", () => {
    delete process.env.XDG_CONFIG_HOME;
    expect(studioConfigRoot()).toBe(
      join(homedir(), ".config", "beancount-js"),
    );
  });

  test("honors an explicit override", () => {
    expect(studioConfigRoot("/custom/config")).toBe("/custom/config");
  });
});

describe("project studio paths", () => {
  test("resolve under .beancount", () => {
    expect(projectIngestionRoot("/ledger")).toBe(
      join("/ledger", ".beancount", "ingestion"),
    );
    expect(projectAiSessionsRoot("/ledger")).toBe(
      join("/ledger", ".beancount", "ai-sessions"),
    );
  });
});
