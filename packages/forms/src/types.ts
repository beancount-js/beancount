export type FormFieldKind = "text" | "textarea" | "readonly";

export interface FormFieldConfig<TRoot, TContext = undefined, TValue = unknown> {
  id: string;
  label: string;
  kind: FormFieldKind;
  description?: string;
  placeholder?: string;
  readonly?: boolean;
  get: (root: TRoot, context: TContext) => TValue;
  set?: (root: TRoot, value: TValue, context: TContext) => TRoot;
  format?: (value: TValue, root: TRoot, context: TContext) => string;
}

export interface FormConfig<TRoot, TContext = undefined> {
  id: string;
  fields: Array<FormFieldConfig<TRoot, TContext, string>>;
}
