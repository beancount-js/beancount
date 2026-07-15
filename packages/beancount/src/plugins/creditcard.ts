/* eslint-disable @typescript-eslint/no-explicit-any */
import { Decimal } from "@beancount-js/parser";
import { Amount, Balance, Pad, sorted, Transaction } from "../core";
import type { BeancountOptions, Directives } from "../core";
import { ValidationError } from "../ops/validation";
import { z } from "zod";
import { LoadError } from "../parser/loader";
import { decimal, yamlProcessor } from "../core/options";
import { RRule } from "rrule";
import { DateTime } from "luxon";

export type Payment = {
  interestRate: Decimal;
  payment: Decimal;
  interest: Decimal;
  principal: Decimal;
  balance: Decimal;
};

export const creditCardOptions = z.object({
  balance: decimal,
  interestRate: decimal,
  minPaymentPercent: decimal,
  minPayment: decimal,
  fixedPayment: decimal.optional(),
  padAccount: z.string().optional(),
});

/** Configuration for the plugin declaration itself, not transaction metadata. */
export const creditCardPluginOptions = z
  .object({
    tag: z.string().min(1).optional(),
  })
  .strict();

const creditCardPluginSchema = z.preprocess(
  yamlProcessor,
  creditCardPluginOptions,
);

function pluginTag(configuration: string | undefined): {
  tag: string;
  error?: ValidationError;
} {
  if (!configuration) return { tag: "cc" };

  const parsed = creditCardPluginSchema.safeParse(configuration);
  if (parsed.success) return { tag: parsed.data.tag ?? "cc" };

  // Preserve the original plain-string configuration (`plugin ... "cc"`).
  // Structured settings are YAML objects and must validate against the schema.
  if (!/[\n:{\[]/.test(configuration)) return { tag: configuration };

  return {
    tag: "cc",
    error: new ValidationError(
      `Invalid credit-card plugin configuration: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`,
      { configuration },
    ),
  };
}

export type CreatePaymentScheduleRequest = {
  /** The current credit card balance. e.g., 10000 */
  balance: Decimal;

  /**
   * If provided, used instead of the minPaymentPercent to calculate the payment
   * schedule. e.g., 200
   */
  fixedPayment?: Decimal;

  /** Set to true to include all payments. Defaults to false. */
  includePayments?: boolean;

  /** The annualized interest rate. e.g., .129 */
  interestRate: Decimal;

  /**
   * The percent of balance that makes up the principal portion. of the payment
   * e.g., .01
   */
  minPaymentPercent: Decimal;

  /** When the balance drops below this number, use this as the payment. e.g., 25 */
  minPayment: Decimal;
};

export type PaymentSchedule = {
  /** The total payment due for the first payment in the schedule. e.g., 282.50 */
  firstPaymentAmount: Decimal;

  /** Total number of payments until the balance is paid off in full. e.g., 299 */
  monthsToPayOff: number;

  /** The acutal payments that make up the complete schedule. */
  payments?: Payment[];

  /** Total interest to be paid over the lifetime of the schedule. e.g., 17185.56 */
  totalInterestPaid: Decimal;

  /**
   * Total principal to be paid over the lifetime of the schedule. e.g.,
   * 10000.00
   */
  totalPrincipalPaid: Decimal;

  /**
   * Total amount (interest and principal) to be paid over the lifetime of the
   * schdule. e.g., 27185.56
   */
  totalRepaymentAmount: Decimal;
};

export const createPayment = (
  balance: Decimal,
  interestRate: Decimal,
  minPayment: Decimal,
  minPaymentPercent: Decimal,
  fixedPayment?: Decimal,
): Payment => {
  const interest = interestRate.div(12).mul(balance);

  const minimumPayment = minPaymentPercent.mul(balance).plus(interest);
  const maximumPayment = Decimal.max(minimumPayment, minPayment);

  const payment = Decimal.min(
    fixedPayment && fixedPayment.gte(maximumPayment)
      ? fixedPayment
      : maximumPayment,
    interest.plus(balance),
  );

  const principal = payment.minus(interest);
  const newBalance = balance.minus(principal);

  return {
    balance: newBalance.toScale(2),
    interest: interest.toScale(2),
    interestRate: interestRate,
    payment: payment.toScale(2),
    principal: principal.toScale(2),
  };
};

export const createPaymentSchedule = (
  request: CreatePaymentScheduleRequest,
): PaymentSchedule => {
  const payments: Payment[] = [];
  const {
    balance: startingBalance,
    fixedPayment,
    interestRate,
    minPayment,
    minPaymentPercent,
  } = request;
  const firstPayment = createPayment(
    startingBalance,
    interestRate,
    minPayment,
    minPaymentPercent,
    fixedPayment,
  );
  payments.push(firstPayment);

  let remainingBalance = firstPayment.balance;
  while (remainingBalance.gt(0)) {
    const payment = createPayment(
      remainingBalance,
      interestRate,
      minPayment,
      minPaymentPercent,
      fixedPayment,
    );
    payments.push(payment);
    remainingBalance = payment.balance;
  }

  const firstPaymentAmount = payments[0].payment;
  const monthsToPayOff = payments.length;
  const totalInterestPaid = payments
    .reduce((sum, p) => sum.plus(p.interest), Decimal.ZERO)
    .toScale(2);
  const totalPrincipalPaid = payments
    .reduce((sum, p) => sum.plus(p.principal), Decimal.ZERO)
    .toScale(2);
  const totalRepaymentAmount = totalInterestPaid.plus(totalPrincipalPaid);

  const paymentSchedule: PaymentSchedule = {
    firstPaymentAmount,
    monthsToPayOff,
    totalInterestPaid,
    totalPrincipalPaid,
    totalRepaymentAmount,
  };

  if (request.includePayments === true) paymentSchedule.payments = payments;
  return paymentSchedule;
};

export function creditCard(
  entries: Directives,
  options: BeancountOptions,
  configuration?: string,
): [Directives, Array<ValidationError>] {
  const errors: Array<ValidationError> = [];
  const config = pluginTag(configuration);
  if (config.error) return [entries, [config.error]];
  const tagName = config.tag;
  const creditCardEntries: Transaction[] = [];
  const filteredEntries: Directives = [];
  const newEntries: Directives = [];

  entries.forEach((directive) => {
    if (directive instanceof Transaction && directive.tags.includes(tagName)) {
      creditCardEntries.push(directive);
    } else {
      filteredEntries.push(directive);
    }
  });

  creditCardEntries.forEach((entry) => {
    const opts = creditCardOptions.safeParse(entry.meta);
    if (opts.error) {
      opts.error.issues.forEach((err: any) => {
        const key = err.path[0] ?? err.keys[0];
        const message = `${key}: ${err.message}`;
        errors.push(new LoadError(message, { entry }));
      });
      return;
    }

    if (entry.postings.length !== 3) {
      errors.push(
        new LoadError(
          `Expected 3 accounts  ${options.name_assets}: / ${options.name_liabilities}: / ${options.name_expenses}: `,
          { entry },
        ),
      );
      return;
    }

    const assets = entry.postings.find((it) =>
      it.account.startsWith(`${options.name_assets}:`),
    );
    const liability = entry.postings.find((it) =>
      it.account.startsWith(`${options.name_liabilities}:`),
    );
    const expenses = entry.postings.find((it) =>
      it.account.startsWith(`${options.name_expenses}:`),
    );

    if (!assets || !liability || !expenses) {
      const message: string[] = [];
      if (!assets) message.push(`Missing account ${options.name_assets}:`);
      if (!liability)
        message.push(`Missing account ${options.name_liabilities}:`);
      if (!expenses) message.push(`Missing account ${options.name_expenses}:`);
      errors.push(new LoadError(message.join(","), { entry }));
      return;
    }

    const units = assets.units;
    if (!units?.currency) {
      errors.push(
        new LoadError(
          `missing units/currency for asset account ${assets.account}`,
        ),
      );
      return;
    }

    const props = opts.data;
    const fixedPayment = (props.fixedPayment ?? units?.value)?.abs();
    const schedule = createPaymentSchedule({
      ...props,
      includePayments: true,
      fixedPayment,
    });

    const now = DateTime.now();

    const rule = new RRule({
      freq: RRule.MONTHLY,
      dtstart: entry.date.toUTC().toJSDate(),
      count: schedule.monthsToPayOff,
    });

    newEntries.push(
      new Balance(
        entry.date,
        liability.account,
        new Amount(schedule.totalPrincipalPaid, units.currency).neg(),
      ),
      new Pad(
        entry.date.minus({ week: 1 }),
        liability.account,
        props.padAccount ??
          `${options.name_equity}:${options.account_previous_balances}`,
      ),
    );

    rule.all().forEach((date, index) => {
      const payment = schedule.payments![index];
      const dt = DateTime.fromISO(date.toISOString(), { zone: "utc" });

      const postings = [
        liability.copy({
          units: new Amount(payment.principal, units.currency),
        }),
        expenses.copy({
          units: new Amount(
            payment.payment.minus(payment.principal),
            units.currency,
          ),
        }),
        assets.copy({
          units: new Amount(payment.payment, units.currency).neg(),
        }),
      ];

      newEntries.push(
        entry.copy({
          date: dt,
          flag: dt > now ? "!" : entry.flag,
          postings,
          meta: {
            ...entry.meta,
            ...payment,
            count: `${index + 1} / ${schedule.monthsToPayOff}`,
          },
        }),
      );
    });
  });

  return [sorted([...filteredEntries, ...newEntries]), errors];
}
