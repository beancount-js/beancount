import { Transaction } from "@beancount-js/beancount";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  buildJournalMerchantLogoMaps,
  resolveJournalMerchantLogo,
} from "./journal-merchant-logos";

describe("journal-merchant-logos", () => {
  it("resolves logos by merchant_id and payee alias", () => {
    const maps = buildJournalMerchantLogoMaps([
      {
        merchantId: "m-tesco",
        canonicalName: "Tesco",
        logoUrl: "/logo/tesco",
        aliases: [{ normalizedValue: "tesco stores" }],
      },
    ]);

    const byId = new Transaction(
      DateTime.fromISO("2026-07-01"),
      "*",
      "Tesco",
      "Groceries",
      [],
      [],
      [],
      { merchant_id: "m-tesco" },
    );
    expect(resolveJournalMerchantLogo(byId, maps)).toBe("/logo/tesco");

    const byAlias = new Transaction(
      DateTime.fromISO("2026-07-01"),
      "*",
      "TESCO STORES",
      "",
      [],
      [],
      [],
      {},
    );
    expect(resolveJournalMerchantLogo(byAlias, maps)).toBe("/logo/tesco");
  });
});
