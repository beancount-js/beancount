import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";

/** A value that can be inserted after a field operator. */
export type SearchFilterValue = {
  value: string;
  label?: string;
  description?: string;
  /** Defaults to `value`; callers may supply quoted or otherwise safe syntax. */
  apply?: string;
};

/** A canonical query field and the syntax it accepts in one search context. */
export type SearchFilterField = {
  name: string;
  description: string;
  operators: readonly string[];
  aliases?: readonly string[];
  values?: readonly (SearchFilterValue | string)[];
};

export type SearchFilterExample = {
  query: string;
  description: string;
};

/**
 * Opt-in completion and help content for one filter-query search context.
 * The host owns domain fields and values; SearchFilterBar only renders and
 * completes this display model.
 */
export type SearchFilterSyntax = {
  title?: string;
  description?: string;
  fields: readonly SearchFilterField[];
  examples?: readonly SearchFilterExample[];
  notes?: readonly string[];
};

const MAX_VALUE_SUGGESTIONS = 100;
const FIELD_TOKEN = /[A-Za-z][A-Za-z0-9.*$_-]*/;
const VALUE_TOKEN = /[^\s()]+/;

function fieldForName(syntax: SearchFilterSyntax, name: string) {
  const normalizedName = name.toLocaleLowerCase();
  return syntax.fields.find(
    (field) =>
      field.name.toLocaleLowerCase() === normalizedName ||
      field.aliases?.some(
        (alias) => alias.toLocaleLowerCase() === normalizedName,
      ),
  );
}

export type SearchFilterCompletionStage = "field" | "operator" | "value";

/**
 * Identify the next syntax token at a query position. SearchFilterBar uses
 * this to distinguish the compact field/operator menus from the scrollable
 * dynamic-value menu.
 */
export function searchFilterCompletionStage(
  syntax: SearchFilterSyntax,
  query: string,
  position = query.length,
): SearchFilterCompletionStage | null {
  const before = query.slice(0, position);

  const valueMatch = before.match(
    /(?:^|[\s(,])([A-Za-z][A-Za-z0-9.*$_-]*)\s*(>=|<=|!=|!~|>|<|=|~|:)\s*([^\s()]*)$/,
  );
  if (valueMatch && fieldForName(syntax, valueMatch[1]!)) return "value";

  const operatorMatch = before.match(
    /(?:^|[\s(,])([A-Za-z][A-Za-z0-9.*$_-]*)\s+([!<>=~:]*)$/,
  );
  if (operatorMatch && fieldForName(syntax, operatorMatch[1]!)) {
    return "operator";
  }

  const fieldMatch = before.match(new RegExp(`${FIELD_TOKEN.source}$`));
  if (
    fieldMatch &&
    syntax.fields.some((field) =>
      field.name
        .toLocaleLowerCase()
        .startsWith(fieldMatch[0]!.toLocaleLowerCase()),
    )
  ) {
    return "field";
  }

  return null;
}

function uniqueValues(field: SearchFilterField): SearchFilterValue[] {
  const values = new Map<string, SearchFilterValue>();
  for (const value of field.values ?? []) {
    const normalized = typeof value === "string" ? { value } : value;
    const key = normalized.value.trim().toLocaleLowerCase();
    if (!key || values.has(key)) continue;
    values.set(key, normalized);
  }
  return [...values.values()]
    .sort((left, right) =>
      (left.label ?? left.value).localeCompare(
        right.label ?? right.value,
        undefined,
        {
          sensitivity: "base",
        },
      ),
    )
    .slice(0, MAX_VALUE_SUGGESTIONS);
}

function fieldCompletions(syntax: SearchFilterSyntax): Completion[] {
  return syntax.fields.map((field) => ({
    label: field.name,
    detail: field.description,
    type: "property",
    apply: `${field.name} `,
  }));
}

function operatorCompletions(field: SearchFilterField): Completion[] {
  return field.operators.map((operator) => ({
    label: operator,
    detail: operatorDescription(operator),
    type: "operator",
    apply: `${operator} `,
  }));
}

function operatorDescription(operator: string) {
  return (
    {
      ":": "matches",
      "=": "equals",
      "!=": "does not equal",
      ">": "greater than",
      ">=": "greater than or equal to",
      "<": "less than",
      "<=": "less than or equal to",
      "~": "contains",
      "!~": "does not contain",
    }[operator] ?? "comparison"
  );
}

function valueCompletions(field: SearchFilterField): Completion[] {
  return uniqueValues(field).map((value) => ({
    label: value.label ?? value.value,
    detail: value.description,
    type: "constant",
    apply: value.apply ?? value.value,
  }));
}

function result(
  from: number,
  options: Completion[],
  validFor: RegExp,
): CompletionResult | null {
  return options.length ? { from, options, validFor } : null;
}

/**
 * Build a CodeMirror completion source for a supplied filter schema.
 * It only opens automatically for a field prefix, a known field operator, or
 * a known field value; arbitrary free text keeps its unobstructed behaviour.
 */
export function searchFilterCompletion(
  syntax: SearchFilterSyntax,
): CompletionSource {
  return (context: CompletionContext) => {
    const before = context.state.sliceDoc(0, context.pos);
    const stage = searchFilterCompletionStage(syntax, before);

    if (stage === "value") {
      const valueMatch = before.match(
        /(?:^|[\s(,])([A-Za-z][A-Za-z0-9.*$_-]*)\s*(>=|<=|!=|!~|>|<|=|~|:)\s*([^\s()]*)$/,
      );
      if (!valueMatch) return null;
      const field = fieldForName(syntax, valueMatch[1]!);
      if (field) {
        return result(
          context.pos - valueMatch[3]!.length,
          valueCompletions(field),
          VALUE_TOKEN,
        );
      }
    }

    if (stage === "operator") {
      const operatorMatch = before.match(
        /(?:^|[\s(,])([A-Za-z][A-Za-z0-9.*$_-]*)\s+([!<>=~:]*)$/,
      );
      if (!operatorMatch) return null;
      const field = fieldForName(syntax, operatorMatch[1]!);
      if (field) {
        return result(
          context.pos - operatorMatch[2]!.length,
          operatorCompletions(field),
          /[!<>=~:]*/,
        );
      }
    }

    if (stage !== "field" && !context.explicit) return null;
    const fieldMatch = context.matchBefore(FIELD_TOKEN);
    if (
      fieldMatch &&
      !syntax.fields.some((field) =>
        field.name
          .toLocaleLowerCase()
          .startsWith(fieldMatch.text.toLocaleLowerCase()),
      )
    ) {
      return null;
    }
    return result(
      fieldMatch?.from ?? context.pos,
      fieldCompletions(syntax),
      FIELD_TOKEN,
    );
  };
}
