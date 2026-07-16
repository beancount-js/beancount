import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parseDotenvEntries, parseDotenvKeys } from "@beancount-js/workspace";
import {
  envSecretAvailable,
  readProjectEnvEntries,
  resolveEnvSecret,
  resolveProjectEnv,
} from "./project-env";

describe("parseDotenvKeys", () => {
  test("parses keys from comments, export, and quoted values", () => {
    const contents = `
# comment
FOO=bar
export BAR="quoted value"
BAZ='single'
INVALID-KEY=nope
123BAD=nope
EMPTY=
`;
    expect(parseDotenvKeys(contents)).toEqual(["BAR", "BAZ", "EMPTY", "FOO"]);
  });

  test("returns sorted unique keys", () => {
    expect(parseDotenvKeys("Z=1\nA=2\nZ=3\n")).toEqual(["A", "Z"]);
  });
});

describe("parseDotenvEntries", () => {
  test("returns unquoted values without exposing malformed keys", () => {
    expect(
      parseDotenvEntries(`
export API_KEY="secret-value"
# ignore
NOT VALID=1
PLAIN=hello
`),
    ).toEqual({
      API_KEY: "secret-value",
      PLAIN: "hello",
    });
  });
});

describe("project env overlay", () => {
  test("reads project .env values for server-side resolution", async () => {
    const root = await mkdtemp(join(tmpdir(), "beancount-project-env-"));
    await writeFile(
      join(root, ".env"),
      'LUNCHFLOW_API_KEY="from-file"\nOTHER=1\n',
    );

    expect(await readProjectEnvEntries(root)).toEqual({
      LUNCHFLOW_API_KEY: "from-file",
      OTHER: "1",
    });

    const env = await resolveProjectEnv(root);
    expect(resolveEnvSecret("env:LUNCHFLOW_API_KEY", env)).toBe("from-file");
    expect(envSecretAvailable("env:LUNCHFLOW_API_KEY", env)).toBe(true);
    expect(envSecretAvailable("env:MISSING", env)).toBe(false);
    expect(resolveEnvSecret("inline-secret", env)).toBe("inline-secret");
  });

  test("lets project .env override process.env for the same key", async () => {
    const root = await mkdtemp(join(tmpdir(), "beancount-project-env-"));
    const key = `TEST_OVERLAY_${Date.now()}`;
    process.env[key] = "from-process";
    await writeFile(join(root, ".env"), `${key}=from-file\n`);
    try {
      const env = await resolveProjectEnv(root);
      expect(env[key]).toBe("from-file");
    } finally {
      delete process.env[key];
    }
  });
});
