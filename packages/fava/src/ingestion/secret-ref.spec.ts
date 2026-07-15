import { describe, expect, it } from "vitest";
import {
  isCredentialAvailable,
  isEnvSecretNameValid,
  isSecretConfigured,
  resolveSecretReference,
  secretDisplayValue,
  secretMode,
  secretStoredValue,
} from "./secret-ref";

describe("secret-ref", () => {
  it("round-trips env and inline modes", () => {
    expect(secretMode("env:BANK_TOKEN")).toBe("env");
    expect(secretMode("sk-live")).toBe("inline");
    expect(secretDisplayValue("env:BANK_TOKEN")).toBe("BANK_TOKEN");
    expect(secretDisplayValue("sk-live")).toBe("sk-live");
    expect(secretStoredValue("env", "BANK_TOKEN")).toBe("env:BANK_TOKEN");
    expect(secretStoredValue("env", "env:BANK_TOKEN")).toBe("env:BANK_TOKEN");
    expect(secretStoredValue("inline", " sk-live ")).toBe("sk-live");
  });

  it("validates configuration and env names", () => {
    expect(isSecretConfigured("")).toBe(false);
    expect(isSecretConfigured("env:")).toBe(false);
    expect(isSecretConfigured("env:BANK")).toBe(true);
    expect(isSecretConfigured("sk-live")).toBe(true);
    expect(isEnvSecretNameValid("env:BANK_TOKEN")).toBe(true);
    expect(isEnvSecretNameValid("env:1BAD")).toBe(false);
    expect(isEnvSecretNameValid("sk-live")).toBe(true);
  });

  it("resolves env and inline secrets", () => {
    const env = { BANK_TOKEN: "from-env" };
    expect(resolveSecretReference("env:BANK_TOKEN", env)).toBe("from-env");
    expect(resolveSecretReference("inline-secret", env)).toBe("inline-secret");
    expect(resolveSecretReference("env:MISSING", env)).toBeUndefined();
    expect(isCredentialAvailable("env:BANK_TOKEN", env)).toBe(true);
    expect(isCredentialAvailable("env:MISSING", env)).toBe(false);
    expect(isCredentialAvailable("inline-secret", env)).toBe(true);
  });
});
