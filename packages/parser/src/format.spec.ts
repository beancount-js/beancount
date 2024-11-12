import dedent from "dedent";
import { describe, test, expect } from "vitest";
import { format } from "./format";

describe("format", () => {
  test("align amounts", () => {
    const input = dedent(`
            * Section header

            ;; Accounts (comments)
            2013-01-01 open Expenses:Restaurant
            2013-01-01 open Assets:Cash

            2014-03-02 * "Something"
                Expenses:Restaurant   50.02 USD
                Assets:Cash

            2014-03-05 balance   Assets:Cash  -50.02 USD

            2014-03-10 * "Something"
                Assets:Other   10 HOOL {500.23} USD ; Bla
                Assets:Cash

            `);
    const expected = dedent(`
            * Section header
            
            ;; Accounts (comments)
            2013-01-01 open Expenses:Restaurant
            2013-01-01 open Assets:Cash
            
            2014-03-02 * "Something"
                Expenses:Restaurant            50.02 USD
                Assets:Cash
            
            2014-03-05 balance   Assets:Cash  -50.02 USD
            
            2014-03-10 * "Something"
                Assets:Other                      10 HOOL {500.23} USD ; Bla
                Assets:Cash
        `);
    expect(format(input)).toBe(expected);
  });

  test("align postings start", () => {
    const input = dedent(`
          2014-03-01 * "Something"
            Expenses:Restaurant   50.01 USD
            Assets:Cash

          2014-03-02 * "Something"
           Expenses:Restaurant    50.02 USD
              Assets:Cash

          2014-03-03 * "Something"
            Expenses:Restaurant   50.03 USD
            Assets:Cash
    `);
    const expected = dedent(`
          2014-03-01 * "Something"
            Expenses:Restaurant  50.01 USD
            Assets:Cash

          2014-03-02 * "Something"
            Expenses:Restaurant  50.02 USD
            Assets:Cash

          2014-03-03 * "Something"
            Expenses:Restaurant  50.03 USD
            Assets:Cash
        `);
    expect(format(input)).toBe(expected);
  });

  test("open", () => {
    expect(format("2015-07-16 open Assets:BoA:checking USD")).toBe(
      "2015-07-16 open Assets:BoA:checking USD",
    );
  });

  test("commas", () => {
    const input = dedent(`
        * Section header

        ;; Accounts (comments)
        2013-01-01 open Expenses:Restaurant
        2013-01-01 open Assets:Cash

        2014-03-02 * "Something"
            Expenses:Restaurant   1,050.02 USD
            Assets:Cash

        2014-03-05 balance   Assets:Cash  -1,050.02 USD

        2014-03-10 * "Something"
            Assets:Other   10 HOOL {5,000.23} USD ; Bla
            Assets:Cash

        `);
    const expected = dedent(`
     * Section header
    
     ;; Accounts (comments)
     2013-01-01 open Expenses:Restaurant
     2013-01-01 open Assets:Cash
    
     2014-03-02 * "Something"
         Expenses:Restaurant            1,050.02 USD
         Assets:Cash
    
     2014-03-05 balance   Assets:Cash  -1,050.02 USD
    
     2014-03-10 * "Something"
         Assets:Other                         10 HOOL {5,000.23} USD ; Bla
         Assets:Cash
        `);
    expect(format(input)).toBe(expected);
  });

  test("fixed width", () => {
    const input = dedent(`
        2016-08-01 open Expenses:Test
        2016-08-01 open Assets:Test

        2016-08-02 * "" ""
          Expenses:Test     10.00 USD
          Assets:Test
    `);
    const expected = dedent(`
         2016-08-01 open Expenses:Test
         2016-08-01 open Assets:Test
        
         2016-08-02 * "" ""
           Expenses:Test                           10.00 USD
           Assets:Test
    `);
    expect(format(input, { prefixWidth: 40 })).toBe(expected);
  });

  test("fixed column", () => {
    const input = dedent(`
        2016-08-01 open Expenses:Test
        2016-08-01 open Assets:Test
        2016-08-01 balance Assets:Test  0.00 USD

        2016-08-02 * "" ""
            Expenses:Test     10.00 USD
            Assets:Test
    `);
    const expected = dedent(`
         2016-08-01 open Expenses:Test
         2016-08-01 open Assets:Test
         2016-08-01 balance Assets:Test              0.00 USD
        
         2016-08-02 * "" ""
             Expenses:Test                          10.00 USD
             Assets:Test

    `);
    expect(format(input, { currencyColumn: 50 })).toBe(expected);
  });

  test("currency issue", () => {
    const input = dedent(`
        1970-01-01 open Equity:Opening-balances
        1970-01-01 open Assets:Investments

        2014-03-31 * "opening"
          Assets:Investments                 1.23 FOO_BAR
          Equity:Opening-balances
    `);
    const expected = dedent(`
          1970-01-01 open Equity:Opening-balances
          1970-01-01 open Assets:Investments

          2014-03-31 * "opening"
            Assets:Investments  1.23 FOO_BAR
            Equity:Opening-balances
    `);
    expect(format(input)).toBe(expected);
  });

  test("metadata issue", () => {
    const input = dedent(`
        2020-01-01 open Assets:Test

        2020-11-10 * Test
          payment_amount: 20.00 EUR
          Assets:Test   10.00 EUR
          Assets:Test  -10.00 EUR
    `);
    const expected = dedent(`
        2020-01-01 open Assets:Test

        2020-11-10 * Test
          payment_amount: 20.00 EUR
          Assets:Test                              10.00 EUR
          Assets:Test                             -10.00 EUR
    `);
    expect(format(input, { currencyColumn: 50 })).toBe(expected);
  });

  test("parenthesized binary expressions", () => {
    const input = dedent(`
        2016-08-01 open Expenses:Test
        2016-08-01 open Assets:Test

        2016-08-02 * "" ""
          Expenses:Test     10.0 USD
          Expenses:Test (10.0/2) USD
          Expenses:Test (10.0+2) USD
          Expenses:Test (10.0-2) USD
          Expenses:Test (10.0*2) USD
          Expenses:Test (-10.0*+2) USD
          Expenses:Test (-1,000.0*+2.0) USD
          Assets:Test

        2016-08-03 balance Assets:Test 12.27 USD
        2016-08-03 balance Assets:Test (12.27 + 1.00) USD
    `);
    const expected = dedent(`
        2016-08-01 open Expenses:Test
        2016-08-01 open Assets:Test

        2016-08-02 * "" ""
          Expenses:Test                             10.0 USD
          Expenses:Test                         (10.0/2) USD
          Expenses:Test                         (10.0+2) USD
          Expenses:Test                         (10.0-2) USD
          Expenses:Test                         (10.0*2) USD
          Expenses:Test                       (-10.0*+2) USD
          Expenses:Test                  (-1,000.0*+2.0) USD
          Assets:Test

        2016-08-03 balance Assets:Test             12.27 USD
        2016-08-03 balance Assets:Test    (12.27 + 1.00) USD
    `);
    expect(format(input, { currencyColumn: 50 })).toBe(expected);
  });
});
