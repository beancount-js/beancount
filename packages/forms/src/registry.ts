import type { FormFieldAlign, FormFieldConfig, FormFieldKind, FormFieldRenderArgs, FormFieldWrapper, FormRendererDescriptor, FormValidationIssue, FormViewName } from "./types";

export function fieldIssuesFor<TRoot, TContext, TValue>(issues: FormValidationIssue[], field: Pick<FormFieldConfig<TRoot, TContext, TValue>, "id" | "path">) {
  return issues.filter((issue) => (issue.fieldId && issue.fieldId === field.id) || (issue.path && field.path && issue.path === field.path));
}
export function defaultFieldAlign(kind: FormFieldKind): FormFieldAlign { return ["boolean", "options", "segmented", "choice"].includes(kind) ? "center" : "start"; }
export function defaultFieldWrapper(kind: FormFieldKind): FormFieldWrapper {
  return [
    "boolean",
    "options",
    "segmented",
    "choice",
    "tag-list",
    "chip-list",
    "string-list",
    "reference-list",
    "custom",
  ].includes(kind)
    ? "div"
    : "label";
}
export function viewFallbacks(view: FormViewName, readonly: boolean) { return [...new Set([view, ...(readonly && view !== "readonly" ? ["readonly"] : []), ...(view !== "preview" ? ["preview"] : []), ...(view !== "edit" && !readonly ? ["edit"] : []), "default"])]; }
export function resolveFieldRenderer<TRoot, TContext, TValue>(field: FormFieldConfig<TRoot, TContext, TValue>, view: FormViewName, readonly: boolean): FormRendererDescriptor<TRoot, TContext, TValue> | null { for (const fallback of viewFallbacks(view, readonly)) { const renderer = field.renderers?.[fallback]; if (renderer) return renderer; } return null; }
export function formatFieldValue<TRoot, TContext, TValue>(field: FormFieldConfig<TRoot, TContext, TValue>, value: TValue, root: TRoot, context: TContext) { if (field.format) return field.format(value, root, context); if (value == null || value === "") return ""; if (Array.isArray(value)) return value.filter(Boolean).join(", "); if (typeof value === "boolean") return value ? "Yes" : "No"; return String(value); }
export function rendererPropsFor<TRoot, TContext, TValue>(descriptor: FormRendererDescriptor<TRoot, TContext, TValue>, args: FormFieldRenderArgs<TRoot, TContext, TValue>) { return { ...(typeof descriptor.props === "function" ? descriptor.props(args) : descriptor.props), ...args }; }
