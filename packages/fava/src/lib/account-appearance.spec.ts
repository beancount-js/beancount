import { Open } from "@beancount-js/beancount";
import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { accountAppearances } from "./account-appearance";

describe("accountAppearances", () => {
  it("uses an account's open declaration for avatar appearance metadata", () => {
    const open = new Open(DateTime.fromISO("2026-01-01"), "Assets:Monzo");
    open.meta.color = "#14b8a6";
    open.meta.icon = "landmark";
    open.meta.merchant_id = "merchant:monzo";

    expect(accountAppearances([open]).get("Assets:Monzo")).toEqual({
      color: "#14b8a6",
      icon: "landmark",
      merchantId: "merchant:monzo",
    });
  });

  it("does not create an appearance for accounts without an open declaration", () => {
    expect(accountAppearances([]).get("Assets:Parent")).toBeUndefined();
  });
});
