import { z, ZodIssueCode } from "zod";
import { parseDocument } from "yaml";
import { Booking } from "./data";
import { BeanCountDocument, Decimal, isValidNumber } from "@beancount-js/parser";

export const yamlProcessor = (value: unknown, ctx: z.RefinementCtx) => {
  if (typeof value === "string") {
    try {
      const doc = parseDocument(value);
      doc.errors.forEach((err) => {
        ctx.addIssue({
          code: ZodIssueCode.custom,
          message: err.message,
        });
      });
      return doc.toJS();
    } catch (e) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: (e as Error).message,
      });
    }
  }

  return value;
};

export const bool = z.preprocess((val, ctx) => {
  if (typeof val === "string") {
    if (["1", "true"].includes(val.toLowerCase())) return true;
    if (["0", "false"].includes(val.toLowerCase())) return false;
    ctx.addIssue({
      code: ZodIssueCode.custom,
      message: `Invalid boolean value: ${val}`,
    });
    return;
  }
  if (typeof val === "number") {
    if (val === 0) return false;
    if (val === 1) return true;
    ctx.addIssue({
      code: ZodIssueCode.custom,
      message: `Invalid boolean value: ${val}`,
    });
    return;
  }
  return val;
}, z.coerce.boolean());

export const account = z
  .string()
  .regex(
    /(^((?:[\p{Lu}][\p{L}\p{Nd}-]*)(?::[\p{Lu}\p{Nd}][\p{L}\p{Nd}-]*))$)|(^([A-Z][a-zA-Z0-9_-]+(:([A-Z0-9][A-Za-z0-9-_]*:)*[A-Z0-9][A-Za-z0-9-]*)?)?$)/gu,
  );
export const currency = z.string().regex(/^[A-Z][A-Z0-9'._-]{0,22}[A-Z0-9]$/);
export const bookingSchema = z.nativeEnum(Booking);

export const decimal = z.preprocess((val, ctx) => {
  if (typeof val === "string" || typeof val === "number") {
    if (!isValidNumber(val.toString())) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: `Invalid decimal value: ${val}`,
      });
    }
    return new Decimal(val);
  } else if (val instanceof Decimal) {
    return val;
  }

  ctx.addIssue({
    code: ZodIssueCode.custom,
    message: `Invalid decimal value: ${val}`,
  });
  return undefined;
}, z.instanceof(Decimal));

export const beanCountOptionsSchema = z.object({
  account_current_conversions: account,
  account_current_earnings: account,
  account_previous_balances: z.string().regex(/^[A-Z][A-Za-z0-9_-]*$/gu),
  account_previous_conversions: account,
  account_previous_earnings: account,
  account_rounding: account,
  allow_deprecated_none_for_tags_and_links: bool,
  allow_pipe_separator: bool,
  booking_method: bookingSchema,
  commodities: z.array(currency),
  conversion_currency: z.string().regex(/^([A-Z]+)?$/),
  documents: z.array(z.string()),
  include: z.array(z.string()),
  files: z.array(z.object({
    filename: z.string(),
    options: z.record(z.string(), z.unknown()),
    document: z.instanceof(BeanCountDocument)
  })),
  filename: z.string(),
  infer_tolerance_from_cost: bool,
  inferred_tolerance_default: z.record(currency, decimal),
  inferred_tolerance_multiplier: decimal.refine(
    (num) => num.gte(0),
    "tolerance multiplier must be greater than 0",
  ),
  input_hash: z.string(),
  insert_pythonpath: z.string(),
  long_string_maxlines: z.coerce.number(),
  name_assets: z.string(),
  name_equity: z.string(),
  name_expenses: z.string(),
  name_income: z.string(),
  name_liabilities: z.string(),
  operating_currency: z.array(z.string()),
  plugin: z.array(z.string()),
  plugin_processing_mode: z.string().regex(/^(raw|default)$/),
  render_commas: bool,
  title: z.string(),
});

export type BeancountOptions = z.infer<typeof beanCountOptionsSchema>;

export function defaultBeancountOptions(
  props: Partial<BeancountOptions> = {},
): BeancountOptions {
  return {
    account_current_conversions: "Conversions:Current",
    account_current_earnings: "Earnings:Current",
    account_previous_balances: "Opening-Balances",
    account_previous_conversions: "Conversions:Previous",
    account_previous_earnings: "Earnings:Previous",
    account_rounding: "Rounding",
    allow_deprecated_none_for_tags_and_links: false,
    allow_pipe_separator: false,
    booking_method: Booking.STRICT,
    commodities: [],
    conversion_currency: "",
    include: [],
    files: {},
    documents: [],
    filename: "",
    infer_tolerance_from_cost: false,
    inferred_tolerance_default: {},
    inferred_tolerance_multiplier: new Decimal(0.5),
    input_hash: "",
    insert_pythonpath: "",
    long_string_maxlines: 64,
    name_assets: "Assets",
    name_equity: "Equity",
    name_expenses: "Expenses",
    name_income: "Income",
    name_liabilities: "Liabilities",
    operating_currency: [],
    plugin: [],
    plugin_processing_mode: "default",
    render_commas: true,
    title: "",
    ...props,
  };
}
