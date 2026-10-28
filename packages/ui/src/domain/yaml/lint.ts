import Ajv from "ajv";
import { linter as editorLinter, type Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import { LineCounter, parseDocument, stringify, isNode, Document } from "yaml";
import { Text, type Line } from "@codemirror/state";
import type { ZodAny, ZodTypeAny } from "zod";

export interface ValidatorInput<T> {
  errors: Array<Diagnostic>;
  doc: T;
  positionFor: (path: string[]) => ErrorOffset | undefined;
}
export type DocumentValidator<T> = (state: ValidatorInput<T>) => void;

type ErrorOffset = { from: number; to: number; line: Line };

function lineOffset(
  offset: number,
  lineCounter: LineCounter,
  doc: Text,
): ErrorOffset {
  const { line, col } = lineCounter.linePos(offset);
  const editorLine = doc.line(line);
  return {
    from: editorLine.from + col - 1,
    to: editorLine.to,
    line: editorLine,
  };
}

function pathOffset(
  path: string[],
  yaml: Document,
  lineCounter: LineCounter,
  doc: Text,
): ErrorOffset | undefined {
  const node = yaml.getIn(path, true);
  if (isNode(node) && node.range) {
    return lineOffset(node.range[0], lineCounter, doc);
  }
  return undefined;
}

export function validateSchema<T>(
  input: Text | string,
  schema: object,
  validator?: DocumentValidator<T>,
): [Array<Diagnostic>, T | null] {
  if (typeof input === "string") {
    return validateSchema(Text.of(input.split("\n")), schema, validator);
  }
  const ajv = new Ajv({ allowUnionTypes: true, allErrors: true });
  const validate = ajv.compile(schema);
  const errors: Array<Diagnostic> = [];
  const content = input.toString();
  let record: T | null = null;

  try {
    const lineCounter = new LineCounter();
    const doc = parseDocument(content, { lineCounter });

    if (doc.errors && doc.errors.length > 0) {
      doc.errors.forEach((err) => {
        errors.push({
          ...lineOffset(err.pos[0], lineCounter, input),
          severity: "error",
          message: err.message,
        });
      });
    } else {
      record = doc.toJS() as T;
      if (!validate(record)) {
        const errorMap: Record<
          string,
          {
            keyword: string[];
            message: string[];
            path: string[];
            params: Record<string, any>;
            offsets: ErrorOffset[];
          }
        > = {};
        validate.errors!.forEach((error) => {
          const path = error.instancePath
            .split("/")
            .filter((it) => it.length > 0);
          let pos = pathOffset(path, doc, lineCounter, input);

          if (error.params["additionalProperty"]) {
            const prop = pathOffset(
              [...path, error.params["additionalProperty"]],
              doc,
              lineCounter,
              input,
            );
            if (prop) {
              pos = prop;
            }
          }
          if (pos) {
            const key = pos.line.number.toString();
            errorMap[key] ||= {
              offsets: [],
              keyword: [],
              path: [],
              message: [],
              params: {},
            };

            errorMap[key].keyword.push(error.keyword);
            errorMap[key].path.push(error.instancePath);
            errorMap[key].params = {
              ...errorMap[key].params,
              ...(error.params || {}),
            };
            errorMap[key].offsets.push(pos);
            if (error.message) {
              errorMap[key].message.push(error.message);
            }
          }
        });

        Object.keys(errorMap).forEach((key) => {
          let line: { from: number; to: number } = input.line(+key);
          const error = errorMap[key];
          if (error.offsets.length == 1) {
            line = error.offsets[0];
          }
          errors.push({
            from: line.from,
            to: line.to,
            severity: "error",
            message:
              error.message.join("\n") +
              "\n" +
              stringify({
                keyword: [...new Set(error.keyword)],
                path: [...new Set(error.path)],
                params: error.params,
              }),
          });
        });
      }

      if (validator) {
        validator({
          errors,
          doc: record,
          positionFor: (path: string[]) =>
            pathOffset(path, doc, lineCounter, input),
        });
      }
    }
  } catch (e) {
    console.error("[lint:yaml] ", e);
  }
  return [errors, record];
}

export function linter<T>(schema: object, validator?: DocumentValidator<T>) {
  return editorLinter((view: EditorView) => {
    const [errors] = validateSchema(view.state.doc, schema, validator);
    return errors;
  });
}

export function zodLinter(schema: ZodTypeAny) {
  return editorLinter((view: EditorView) => {
    const lineCounter = new LineCounter();
    const input = view.state.doc;
    const errors: Array<Diagnostic> = [];

    const doc = parseDocument(input.toString(), { lineCounter });
    if (doc.errors && doc.errors.length > 0) {
      doc.errors.forEach((err) => {
        errors.push({
          ...lineOffset(err.pos[0], lineCounter, input),
          severity: "error",
          message: err.message,
        });
      });
    } else {
      const state = schema.safeParse(doc.toJS());
      if (!state.success) {
        state.error.errors.forEach((err) => {
          let path = err.path.map((it) => {
            return it.toString();
          });
          let pos = pathOffset(path, doc, lineCounter, input);

          if (err.code === "unrecognized_keys") {
            const prop = pathOffset(
              [...path, ...err.keys],
              doc,
              lineCounter,
              input,
            );
            if (prop) {
              pos = prop;
            }
          }
          if (pos) {
            errors.push({
              from: pos.from,
              to: pos.to,
              severity: "error",
              message: err.message,
            });
          }
        });
      }
    }
    return errors;
  });
}
