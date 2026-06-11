import { validateSchema, type ValidatorInput } from "../yaml/lint";
import schema from "./schema.json";
import { DateTime } from "luxon";
import { ImportConfig } from "./models";
import { z } from "zod";

export type PostingType =
  | "account"
  | "amount"
  | "multiplier"
  | "date"
  | "payee"
  | "narration"
  | "tags"
  | "links"
  | "currency";

export type ImporterPatternDefinition =
  | string
  | ImporterPatternType
  | Array<ImporterPatternType>;

export interface ImporterPatternType {
  pattern: string;
  score: number;
  flags?: string;
  value?: number | string;
}

export interface ImporterAccount {
  name: string;
  pattern: ImporterPatternDefinition;
  currency: string;
  matchers: Record<string, ImporterPatternDefinition>;
}

export interface ImporterColumn {
  name: string;
  required?: boolean;
  type?: PostingType;
}

export type ImporterColumnDefinition = string | Record<string, ImporterColumn>;

export interface ImporterType {
  name: string;
  version: string;
  columns: Array<ImporterColumnDefinition>;
  dateFormat: string;
  posting: Record<PostingType, ImporterPatternDefinition>;
  accounts: Array<ImporterAccount>;
}

export function validateImporterDocument({
  errors,
  doc,
  positionFor,
}: ValidatorInput<ImporterType>) {
  const pos = positionFor(["dateFormat"]);
  try {
    const data = DateTime.now().toFormat(doc.dateFormat);
    if (pos) {
      errors.push({
        from: pos.from,
        to: pos.to,
        severity: "info",
        message: `Format: ${data}`,
      });
    }
  } catch (e) {
    if (pos) {
      errors.push({
        from: pos.from,
        to: pos.to,
        severity: "error",
        message: `Error: ${e}`,
      });
    }
  }
}

export function loadImporterConfig(contents: string): ImportConfig | null {
  const [errors, doc] = validateSchema<ImporterType>(
    contents,
    schema,
    validateImporterDocument,
  );
  if (!doc) {
    return null;
  }
  return ImportConfig.from(doc);
}

export const importRow = z.object({
  data: z.record(z.any()),
  account: z.string(),
  source: z.string().optional(),
});
export type ImportRow = z.infer<typeof importRow>;

export const importFile = z.object({
  filename: z.string(),
  contents: z.string().optional(),
  data: z.array(importRow.strict()),
});
export type ImportFile = z.infer<typeof importFile>;

export const importData = z.array(importFile);
export type ImportData = z.infer<typeof importData>;
