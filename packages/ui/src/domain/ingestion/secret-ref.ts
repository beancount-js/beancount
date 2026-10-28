export type SecretMode = "env" | "inline";

export function secretMode(value: string | undefined): SecretMode {
  return value?.startsWith("env:") ? "env" : "inline";
}

/** Value shown in the input for the active mode. */
export function secretDisplayValue(value: string | undefined): string {
  if (!value) return "";
  return value.startsWith("env:") ? value.slice("env:".length) : value;
}

/** Persist either `env:NAME` or a raw inline secret. */
export function secretStoredValue(mode: SecretMode, display: string): string {
  const trimmed = display.trim();
  if (mode === "env") {
    const name = trimmed.startsWith("env:")
      ? trimmed.slice("env:".length).trim()
      : trimmed;
    return name ? `env:${name}` : "env:";
  }
  return trimmed;
}

export function isSecretConfigured(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  if (value.startsWith("env:"))
    return value.slice("env:".length).trim().length > 0;
  return true;
}

export function isEnvSecretNameValid(value: string): boolean {
  if (!value.startsWith("env:")) return true;
  const name = value.slice("env:".length);
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

/** True when an env secret can be resolved, or an inline secret is present. */
export function isCredentialAvailable(
  reference: string | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!isSecretConfigured(reference)) return false;
  if (!reference!.startsWith("env:")) return true;
  const name = reference!.slice("env:".length);
  return Boolean(env[name]);
}

export function resolveSecretReference(
  reference: string | undefined,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  if (!reference?.trim()) return undefined;
  if (reference.startsWith("env:")) {
    const name = reference.slice("env:".length);
    return name ? env[name] : undefined;
  }
  return reference;
}
