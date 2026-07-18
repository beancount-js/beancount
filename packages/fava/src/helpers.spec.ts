import { afterEach, describe, expect, test } from "vitest";
import { urlForAccount } from "./helpers";
import { setStudioRouteEnv } from "./lib/studio-route-env";

const routeEnv = {
  projectId: "bean-budget",
  ledgerPath: "personal.beancount",
  ledgerStem: "personal",
  availableLedgers: ["personal.beancount", "household.beancount"],
};

afterEach(() => {
  setStudioRouteEnv({
    projectId: "",
    ledgerPath: "",
    ledgerStem: "",
    availableLedgers: [],
  });
});

describe("ledger-aware account URLs", () => {
  test("uses the explicitly selected ledger for source account links", () => {
    setStudioRouteEnv(routeEnv);

    expect(
      urlForAccount(
        "Liabilities:CreditCard:Amex",
        undefined,
        "household.beancount",
      ),
    ).toBe(
      "/bean-budget/ledger/household/account/Liabilities%3ACreditCard%3AAmex/",
    );
  });
});
