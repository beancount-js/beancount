import { Decimal } from "@beancount-js/parser";
import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "../core/amount";
import { Posting, Transaction } from "../core/data";
import { defaultBeancountOptions } from "../core/options";
import { createPaymentSchedule, creditCard } from "./creditcard";

const date = DateTime.fromISO("2024-01-01");

function creditCardEntry() {
  return new Transaction(
    date,
    "*",
    "",
    "Pay card",
    ["cc"],
    [],
    [
      new Posting("Assets:Cash", new Amount("-100", "USD")),
      new Posting("Liabilities:Card", new Amount("100", "USD")),
      new Posting("Expenses:Interest", new Amount("0", "USD")),
    ],
    {
      balance: new Decimal("100"),
      interestRate: new Decimal("0"),
      minPaymentPercent: new Decimal("0.01"),
      minPayment: new Decimal("25"),
      fixedPayment: new Decimal("100"),
    },
  );
}

describe("credit-card plugin", () => {
  test("builds a deterministic fully-paid schedule and replacement directives", () => {
    const schedule = createPaymentSchedule({
      balance: new Decimal("100"),
      interestRate: new Decimal("0"),
      minPaymentPercent: new Decimal("0.01"),
      minPayment: new Decimal("25"),
      fixedPayment: new Decimal("100"),
      includePayments: true,
    });
    expect(schedule.monthsToPayOff).toBe(1);
    expect(schedule.totalPrincipalPaid.toString()).toBe("100.00");
    expect(schedule.totalInterestPaid.toString()).toBe("0.00");

    const [entries, errors] = creditCard(
      [creditCardEntry()],
      defaultBeancountOptions(),
    );

    expect(errors).toEqual([]);
    expect(entries.map((entry) => entry.directiveType)).toEqual([
      "pad",
      "balance",
      "transaction",
    ]);
    const payment = entries.at(-1) as Transaction;
    expect(
      payment.postings.map((posting) => posting.units?.toString()),
    ).toEqual(["100.00 USD", "0.00 USD", "-100.00 USD"]);
    expect(payment.meta.count).toBe("1 / 1");
  });

  test("rejects invalid structured plugin configuration", () => {
    const [entries, errors] = creditCard(
      [creditCardEntry()],
      defaultBeancountOptions(),
      "tag: 1",
    );

    expect(entries).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain(
      "Invalid credit-card plugin configuration",
    );
  });

  test("uses minimum payments and omits payment details when requested", () => {
    const schedule = createPaymentSchedule({
      balance: new Decimal("10"),
      interestRate: new Decimal("0"),
      minPaymentPercent: new Decimal("0.1"),
      minPayment: new Decimal("5"),
    });

    expect(schedule.monthsToPayOff).toBe(2);
    expect(schedule.firstPaymentAmount.toString()).toBe("5.00");
    expect(schedule.payments).toBeUndefined();
    expect(schedule.totalRepaymentAmount.toString()).toBe("10.00");
  });

  test("accepts a plain custom tag and reports malformed card entries", () => {
    const customTagged = creditCardEntry().copy({ tags: ["card"] });
    const [, customTagErrors] = creditCard(
      [customTagged],
      defaultBeancountOptions(),
      "card",
    );
    const [, configErrors] = creditCard(
      [creditCardEntry().copy({ meta: {} })],
      defaultBeancountOptions(),
    );
    const [, postingErrors] = creditCard(
      [
        creditCardEntry().copy({
          postings: creditCardEntry().postings.slice(0, 2),
        }),
      ],
      defaultBeancountOptions(),
    );
    const invalidAccounts = creditCardEntry().copy({
      postings: [
        new Posting("Assets:Cash", new Amount("-100", "USD")),
        new Posting("Equity:Card", new Amount("100", "USD")),
        new Posting("Income:Interest", new Amount("0", "USD")),
      ],
    });
    const [, accountErrors] = creditCard(
      [invalidAccounts],
      defaultBeancountOptions(),
    );
    const missingCurrency = creditCardEntry().copy({
      postings: [
        new Posting("Assets:Cash", new Amount("-100", null)),
        ...creditCardEntry().postings.slice(1),
      ],
    });
    const [, currencyErrors] = creditCard(
      [missingCurrency],
      defaultBeancountOptions(),
    );

    expect(customTagErrors).toEqual([]);
    expect(configErrors[0].message).toContain("balance:");
    expect(postingErrors[0].message).toContain("Expected 3 accounts");
    expect(accountErrors[0].message).toContain("Missing account Liabilities:");
    expect(currencyErrors[0].message).toContain("missing units/currency");
  });
});
