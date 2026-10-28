import { z, ZodIssueCode } from "zod";
import { parseDocument } from "yaml";

function getLang(fallback: string = "en") {
  if (typeof navigator === "undefined") return "en-GB";
  if (navigator.languages != undefined) return navigator.languages[0];
  return navigator.language || fallback;
}

export const yamlProcessor = (value: any, ctx: z.RefinementCtx) => {
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

const bool = z.preprocess((val, ctx) => {
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

export const ledgerOptionsSchema = z.object({
  dashboard_collapsed: bool,
  incognito: bool,
  plugins: z.preprocess(yamlProcessor, z.record(z.record(z.any()))),
});

export type LedgerOptions = z.infer<typeof ledgerOptionsSchema>;

export function defaultLedgerOptions(): LedgerOptions {
  return {
    dashboard_collapsed: false,
    incognito: false,
    plugins: {},
  };
}

export const fiscalYearEndSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  day: z.coerce.number().min(1).max(31),
});

export const insertEntryOptionSchema = z.object({
  date: z.date(),
  re: z.array(z.string()),
  filename: z.string(),
  lineno: z.coerce.number().min(1),
});

export const favaOptionsSchema = z.object({
  account_journal_include_children: bool,
  auto_reload: bool,
  collapse_pattern: z.array(z.string()),
  conversion_currencies: z.array(z.string()),
  currency_column: z.coerce.number(),
  default_file: z.string(),
  default_page: z.string(),
  fiscal_year_end: z.preprocess((val) => {
    if (typeof val === "string") {
      const parts = val.split("-", 2);
      return { month: parts[0], day: parts[1] };
    }
    return val;
  }, fiscalYearEndSchema),
  import_config: z.string(),
  import_dirs: z.array(z.string()),
  indent: z.coerce.number(),
  insert_entry: z.array(insertEntryOptionSchema),
  invert_income_liabilities_equity: bool,
  language: z.string(),
  locale: z.string(),
  show_accounts_with_zero_balance: bool,
  show_accounts_with_zero_transactions: bool,
  show_closed_accounts: bool,
  sidebar_show_queries: z.coerce.number(),
  unrealized: z.string(),
  upcoming_events: z.coerce.number(),
  uptodate_indicator_grey_lookback_days: z.coerce.number(),
  use_external_editor: bool,
});

export type FavaOptions = z.infer<typeof favaOptionsSchema>;
export function defaultFavaOptions(): FavaOptions {
  return {
    account_journal_include_children: true,
    auto_reload: false,
    collapse_pattern: [],
    conversion_currencies: [],
    currency_column: 0,
    default_file: "",
    default_page: "income_statement/",
    fiscal_year_end: { month: 12, day: 31 },
    import_config: "",
    import_dirs: [],
    indent: 2,
    insert_entry: [],
    invert_income_liabilities_equity: false,
    language: "",
    locale: getLang(),
    show_accounts_with_zero_balance: true,
    show_accounts_with_zero_transactions: true,
    show_closed_accounts: false,
    sidebar_show_queries: 5,
    unrealized: "Unrealized",
    upcoming_events: 7,
    uptodate_indicator_grey_lookback_days: 60,
    use_external_editor: false,
  };
}
