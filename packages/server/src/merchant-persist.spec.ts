import { describe, expect, test } from "vitest";
import type { ImportProposal } from "@beancount-js/beangulp";
import {
  candidateForAutoPersist,
  hasMerchantCatalogData,
  proposalMerchantLabel,
} from "./merchant-persist";

function proposal(
  partial: Partial<ImportProposal> &
    Pick<ImportProposal, "id" | "importId" | "status">,
): ImportProposal {
  return {
    suggestions: [],
    issues: [],
    ...partial,
  };
}

describe("hasMerchantCatalogData", () => {
  test("requires domain, description, or brand", () => {
    expect(hasMerchantCatalogData({ domain: "tesco.com" })).toBe(true);
    expect(hasMerchantCatalogData({ description: "Grocery" })).toBe(true);
    expect(
      hasMerchantCatalogData({
        brand: {
          provider: "brandfetch",
          fetchedAt: "2026-07-01T00:00:00.000Z",
          expiresAt: "2026-08-01T00:00:00.000Z",
        },
      }),
    ).toBe(true);
    expect(hasMerchantCatalogData({})).toBe(false);
    expect(hasMerchantCatalogData({ domain: "  " })).toBe(false);
  });
});

describe("proposalMerchantLabel / candidateForAutoPersist", () => {
  test("prefers resolution rawLabel then merchant/payee/narration", () => {
    expect(
      proposalMerchantLabel(
        proposal({
          id: "p1",
          importId: "bank:1",
          status: "ready",
          merchantResolution: {
            status: "unresolved",
            rawLabel: "TESCO STORES",
          },
          transaction: {
            sourceId: "bank",
            sourceAccount: "Assets:Bank",
            bookedAt: "2026-07-01",
            amount: "-10",
            currency: "GBP",
            payee: "Payee",
            narration: "Narration",
            status: "posted",
            fetchedAt: "2026-07-02T00:00:00.000Z",
            metadata: {},
          },
        }),
      ),
    ).toBe("TESCO STORES");
  });

  test("uses top suggested candidate when it has catalog data", () => {
    const candidate = candidateForAutoPersist(
      proposal({
        id: "p1",
        importId: "bank:1",
        status: "ready",
        merchantResolution: {
          status: "suggested",
          rawLabel: "TESCO STORES",
          candidates: [
            {
              id: "low",
              canonicalName: "Low",
              rawScore: 0.2,
              explanation: "low",
              provenance: [],
            },
            {
              id: "high",
              canonicalName: "Tesco",
              domain: "tesco.com",
              rawScore: 0.9,
              explanation: "high",
              provenance: [
                { source: "ai", observedAt: "2026-07-01T00:00:00Z" },
              ],
            },
          ],
          explanation: "suggested",
        },
      }),
    );
    expect(candidate).toMatchObject({
      id: "high",
      canonicalName: "Tesco",
      domain: "tesco.com",
    });
  });

  test("skips suggested candidates without domain, description, or brand", () => {
    expect(
      candidateForAutoPersist(
        proposal({
          id: "p1",
          importId: "bank:1",
          status: "ready",
          merchantResolution: {
            status: "suggested",
            rawLabel: "Pure Gym",
            candidates: [
              {
                id: "thin",
                canonicalName: "Pure Gym",
                rawScore: 0.9,
                explanation: "name only",
                provenance: [],
              },
            ],
            explanation: "suggested",
          },
        }),
      ),
    ).toBeUndefined();
  });

  test("does not create a name-only fallback candidate", () => {
    expect(
      candidateForAutoPersist(
        proposal({
          id: "p1",
          importId: "bank:1",
          status: "ready",
          transaction: {
            sourceId: "bank",
            sourceAccount: "Assets:Bank",
            bookedAt: "2026-07-01",
            amount: "-10",
            currency: "GBP",
            payee: "Pure Gym",
            narration: "Membership",
            status: "posted",
            fetchedAt: "2026-07-02T00:00:00.000Z",
            metadata: {},
          },
          merchantResolution: {
            status: "unresolved",
            rawLabel: "Pure Gym",
            explanation: "missing",
          },
        }),
      ),
    ).toBeUndefined();
  });

  test("skips confirmed and suppressed resolutions", () => {
    expect(
      candidateForAutoPersist(
        proposal({
          id: "p1",
          importId: "bank:1",
          status: "ready",
          merchantResolution: {
            status: "confirmed",
            rawLabel: "Tesco",
            merchant: {
              merchantId: "m1",
              canonicalName: "Tesco",
              aliases: [],
              provenance: [],
            },
            explanation: "ok",
          },
        }),
      ),
    ).toBeUndefined();
    expect(
      candidateForAutoPersist(
        proposal({
          id: "p2",
          importId: "bank:2",
          status: "ready",
          merchantResolution: {
            status: "suppressed",
            rawLabel: "Spam",
            explanation: "dismissed",
          },
        }),
      ),
    ).toBeUndefined();
  });
});
