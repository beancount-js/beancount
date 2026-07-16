import {
  createFormConfig,
  textField,
  type FormConfig,
} from "@beancount-js/forms";
import type { ConnectorFieldSpec } from "@beancount-js/beangulp";
import type { EditableIngestionSource } from "./source-form";
import {
  secretField,
  switchField,
  type SourceFormContext,
} from "./source-form-config";

function getAtPath(root: unknown, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = root;
  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setAtPath(
  root: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length) return root;
  const next = { ...root };
  let cursor: Record<string, unknown> = next;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index]!;
    const child = cursor[key];
    const childRecord =
      child && typeof child === "object" && !Array.isArray(child)
        ? { ...(child as Record<string, unknown>) }
        : {};
    cursor[key] = childRecord;
    cursor = childRecord;
  }
  const leaf = parts[parts.length - 1]!;
  if (
    value === undefined ||
    value === "" ||
    (typeof value === "string" && !value.trim())
  ) {
    delete cursor[leaf];
  } else {
    cursor[leaf] = value;
  }
  return next;
}

function withConfig(
  source: EditableIngestionSource,
  config: Record<string, unknown>,
): EditableIngestionSource {
  return { ...source, config };
}

export function connectorFieldsForm(
  fields: readonly ConnectorFieldSpec[],
  formId: string,
): FormConfig<EditableIngestionSource, SourceFormContext> {
  return createFormConfig<EditableIngestionSource, SourceFormContext>({
    id: formId,
    fields: fields.map((field) => {
      if (field.kind === "secret") {
        return secretField({
          id: field.id,
          label: field.label,
          get: (source) => {
            const value = getAtPath(source.config ?? {}, field.path);
            return typeof value === "string" ? value : "";
          },
          set: (source, value) =>
            withConfig(
              source,
              setAtPath(
                {
                  ...((source.config as Record<string, unknown> | undefined) ??
                    {}),
                },
                field.path,
                value,
              ),
            ),
        });
      }
      if (field.kind === "switch") {
        return switchField({
          id: field.id,
          label: field.label,
          get: (source) => {
            const value = getAtPath(source.config ?? {}, field.path);
            if (typeof value === "boolean") return value;
            return field.default === true;
          },
          set: (source, value) =>
            withConfig(
              source,
              setAtPath(
                {
                  ...((source.config as Record<string, unknown> | undefined) ??
                    {}),
                },
                field.path,
                value,
              ),
            ),
        });
      }
      return textField({
        id: field.id,
        label: field.label,
        path: `config.${field.path}`,
        placeholder: field.placeholder,
        get: (source) => {
          const value = getAtPath(source.config ?? {}, field.path);
          if (typeof value === "number") return String(value);
          return typeof value === "string" ? value : "";
        },
        set: (source, raw) => {
          const trimmed = raw.trim();
          let next: unknown = trimmed || undefined;
          if (
            field.path === "lookbackDays" &&
            trimmed &&
            /^-?\d+$/.test(trimmed)
          ) {
            next = Number(trimmed);
          }
          return withConfig(
            source,
            setAtPath(
              {
                ...((source.config as Record<string, unknown> | undefined) ??
                  {}),
              },
              field.path,
              next,
            ),
          );
        },
      });
    }),
  });
}
