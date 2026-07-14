import type { FormConfig, FormFieldConfig } from "./types";

export function createFormConfig<TRoot, TContext = undefined>(
  config: FormConfig<TRoot, TContext>,
) {
  return config;
}

export function textField<TRoot, TContext = undefined>(
  config: Omit<FormFieldConfig<TRoot, TContext, string>, "kind">,
) {
  return { ...config, kind: "text" as const };
}

export function textareaField<TRoot, TContext = undefined>(
  config: Omit<FormFieldConfig<TRoot, TContext, string>, "kind">,
) {
  return { ...config, kind: "textarea" as const };
}

export function readonlyField<TRoot, TContext = undefined>(
  config: Omit<FormFieldConfig<TRoot, TContext, string>, "kind" | "readonly">,
) {
  return { ...config, kind: "readonly" as const, readonly: true };
}

export type { FormConfig, FormFieldConfig, FormFieldKind } from "./types";
