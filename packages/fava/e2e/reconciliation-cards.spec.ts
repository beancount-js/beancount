import { expect, test, type Page } from "@playwright/test";
import { gotoStudio } from "./helpers";

const reconciliationReview = {
  candidates: [
    {
      candidate: {
        id: "match-high",
        kind: "overlap",
        memberIds: ["proposal:monzo", "ledger:monzo"],
        confidence: "high",
        evidence: [
          {
            kind: "same-account",
            summary: "Both records affect the same account.",
          },
        ],
        recommendedCanonicalId: "ledger:monzo",
      },
      members: [
        {
          observation: {
            id: "proposal:monzo",
            origin: "proposal",
            sourceId: "monzo:acc_00009Oi2dGmNEEumb2r1PN",
            sourceAccount: "Assets:Checking:Monzo",
            bookedAt: "2026-07-01",
            amount: "-45.75",
            currency: "GBP",
            merchant: "June overdraft fees",
            status: "posted",
          },
        },
        {
          observation: {
            id: "ledger:monzo",
            origin: "ledger",
            sourceAccount: "Assets:Checking:Monzo",
            bookedAt: "2026-07-01",
            amount: "-45.75",
            currency: "GBP",
            merchant: "June overdraft fees",
            status: "posted",
          },
        },
      ],
    },
    {
      candidate: {
        id: "match-possible",
        kind: "existing",
        memberIds: ["proposal:lunchflow", "ledger:lunchflow"],
        confidence: "possible",
        evidence: [
          {
            kind: "matching-label",
            summary: "Merchant or narration labels agree.",
          },
        ],
        recommendedCanonicalId: "ledger:lunchflow",
      },
      members: [
        {
          observation: {
            id: "proposal:lunchflow",
            origin: "proposal",
            sourceId: "lunchflow:7073",
            sourceAccount: "Assets:Checking:Starling",
            bookedAt: "2026-05-11",
            amount: "-34.39",
            currency: "GBP",
            merchant: "Natwest Platinum Card",
            status: "posted",
          },
        },
        {
          observation: {
            id: "ledger:lunchflow",
            origin: "ledger",
            sourceAccount: "Assets:Checking:Starling",
            bookedAt: "2026-05-11",
            amount: "-34.39",
            currency: "GBP",
            merchant: "Natwest Platinum Card",
            status: "posted",
          },
        },
      ],
    },
  ],
};

async function openReconciliationReview(
  page: Page,
  review = reconciliationReview,
) {
  const summary = {
    id: "mock-run",
    sourceId: "monzo",
    startedAt: "2026-07-01T12:00:00.000Z",
    completedAt: "2026-07-01T12:01:00.000Z",
    reviewState: "pending",
    summary: {
      total: 1,
      ready: 0,
      needsReview: 1,
      accepted: 0,
      duplicates: 0,
      invalid: 0,
      held: 0,
      excluded: 0,
    },
    updatedAt: "2026-07-01T12:01:00.000Z",
  };
  await page.route("**/ingestion/runs?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        runs: [summary],
        total: 1,
        offset: 0,
        limit: 100,
      }),
    });
  });
  await page.route("**/ingestion/runs/mock-run", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        id: summary.id,
        sourceId: summary.sourceId,
        startedAt: summary.startedAt,
        completedAt: summary.completedAt,
        proposals: [],
        summary: summary.summary,
      }),
    });
  });
  await page.route("**/ingestion/reconciliation", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(review),
    });
  });
  await gotoStudio(page, "/records?review=reconciliation");
  await expect(page.locator("[data-ingestion-reconciliation]")).toBeVisible();
}

test("styles reconciliation cards with aligned rows and compact actions", async ({
  page,
}) => {
  await openReconciliationReview(page);

  const cards = page.locator("[data-ingestion-reconciliation] > section");
  await expect(cards).toHaveCount(2);

  const kind = cards.first().locator("[data-reconciliation-kind]");
  await expect(kind).toHaveText("Same Account Overlap");
  expect(
    await kind.evaluate((node) => getComputedStyle(node).fontVariantCaps),
  ).toBe("all-small-caps");

  const high = page.locator('[data-reconciliation-confidence="high"]');
  const possible = page.locator('[data-reconciliation-confidence="possible"]');
  await expect(high).toHaveClass(/bg-success/);
  await expect(possible).toHaveClass(/bg-warning/);
  expect(
    await high.evaluate((node) => getComputedStyle(node).backgroundColor),
  ).not.toBe(
    await possible.evaluate((node) => getComputedStyle(node).backgroundColor),
  );

  const confirm = cards.first().getByRole("button", { name: "Confirm match" });
  const dismiss = cards.first().getByRole("button", { name: "Not a match" });
  for (const action of [confirm, dismiss]) {
    await expect(action).toHaveClass(/size-8/);
    await expect(action).toHaveClass(/hover:bg-accent/);
    const box = await action.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(32);
    expect(box?.height).toBeLessThanOrEqual(32);
  }
  await confirm.hover();
  await expect
    .poll(() =>
      confirm.evaluate((node) => getComputedStyle(node).backgroundColor),
    )
    .not.toBe("rgba(0, 0, 0, 0)");

  await expect(page.getByText("monzo:acc_00009Oi2dGmNEEumb2r1PN")).toHaveCount(
    0,
  );
  await expect(
    cards.first().locator("[data-reconciliation-member-source]"),
  ).toHaveText(["Monzo", "Ledger"]);
  await expect(
    cards.nth(1).locator("[data-reconciliation-member-source]"),
  ).toHaveText(["Lunchflow", "Ledger"]);
  expect(
    await cards
      .first()
      .locator("[data-reconciliation-member-source]")
      .first()
      .evaluate((node) => getComputedStyle(node).position),
  ).not.toBe("absolute");

  const firstRow = cards
    .first()
    .locator("[data-reconciliation-member-row]")
    .first();
  const restingBackground = await firstRow.evaluate(
    (node) => getComputedStyle(node).backgroundColor,
  );
  await firstRow.hover();
  await expect
    .poll(() =>
      firstRow.evaluate((node) => getComputedStyle(node).backgroundColor),
    )
    .not.toBe(restingBackground);

  const rowMetrics = await cards
    .first()
    .locator("[data-reconciliation-member-row]")
    .evaluateAll((rows) =>
      rows.map((row) => {
        const amount = row.querySelector<HTMLElement>(
          "[data-reconciliation-member-amount]",
        );
        const avatar = row.querySelector<HTMLElement>(
          "[data-reconciliation-member-avatar]",
        );
        const details = row.querySelector<HTMLElement>(
          "[data-reconciliation-member-details]",
        );
        const source = row.querySelector<HTMLElement>(
          "[data-reconciliation-member-source]",
        );
        const sourceBox = source?.getBoundingClientRect();
        const rowBox = row.getBoundingClientRect();
        return {
          columns: getComputedStyle(row).gridTemplateColumns,
          amountX: amount?.getBoundingClientRect().x,
          avatarX: avatar?.getBoundingClientRect().x,
          detailsX: details?.getBoundingClientRect().x,
          sourceCenterX: sourceBox ? sourceBox.x + sourceBox.width / 2 : 0,
          sourceCenterY: sourceBox ? sourceBox.y + sourceBox.height / 2 : 0,
          rowCenterY: rowBox.y + rowBox.height / 2,
        };
      }),
    );
  expect(rowMetrics[0]?.columns).toBe(rowMetrics[1]?.columns);
  expect(rowMetrics[0]?.amountX).toBe(rowMetrics[1]?.amountX);
  expect(rowMetrics[0]?.avatarX).toBe(rowMetrics[1]?.avatarX);
  expect(rowMetrics[0]?.detailsX).toBe(rowMetrics[1]?.detailsX);
  expect(rowMetrics[0]?.sourceCenterX).toBeCloseTo(
    rowMetrics[1]?.sourceCenterX ?? 0,
    1,
  );
  expect(
    Math.abs(
      (rowMetrics[0]?.sourceCenterY ?? 0) - (rowMetrics[0]?.rowCenterY ?? 0),
    ),
  ).toBeLessThanOrEqual(1);
  expect(rowMetrics[0]?.avatarX).toBeLessThan(rowMetrics[0]?.detailsX ?? 0);
  expect(rowMetrics[0]?.detailsX).toBeLessThan(
    rowMetrics[0]?.sourceCenterX ?? 0,
  );
  expect(rowMetrics[0]?.sourceCenterX).toBeLessThan(
    rowMetrics[0]?.amountX ?? 0,
  );
});

test("keeps reconciliation card rows contained on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReconciliationReview(page);

  const firstRow = page.locator("[data-reconciliation-member-row]").first();
  await expect(
    firstRow.locator("[data-reconciliation-member-source]"),
  ).toBeVisible();
  await expect(
    firstRow.locator("[data-reconciliation-member-amount]"),
  ).toBeVisible();
  await expect(
    firstRow.locator("[data-reconciliation-member-details]"),
  ).toBeVisible();

  const contained = await firstRow.evaluate((row) => {
    const rowBox = row.getBoundingClientRect();
    return Array.from(row.children).every((child) => {
      const childBox = child.getBoundingClientRect();
      return childBox.left >= rowBox.left && childBox.right <= rowBox.right;
    });
  });
  expect(contained).toBe(true);
});

test("shows responsive numbered reconciliation pagination", async ({
  page,
}) => {
  const manyCandidates = Array.from({ length: 250 }, (_, index) => {
    const template = reconciliationReview.candidates[index % 2]!;
    return {
      ...template,
      candidate: {
        ...template.candidate,
        id: `${template.candidate.id}-${index}`,
        memberIds: template.candidate.memberIds.map(
          (memberId) => `${memberId}-${index}`,
        ),
        recommendedCanonicalId: `${template.candidate.recommendedCanonicalId}-${index}`,
      },
      members: template.members.map((member) => ({
        observation: {
          ...member.observation,
          id: `${member.observation.id}-${index}`,
        },
      })),
    };
  });
  await openReconciliationReview(page, { candidates: manyCandidates });

  const pagination = page.getByRole("navigation", {
    name: "Reconciliation match pages",
  });
  await expect(
    pagination.getByRole("button", { name: "Page 1" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    pagination.getByRole("button", { name: "Page 2", exact: true }),
  ).toBeVisible();
  await expect(pagination.getByText("More pages")).toHaveCount(1);

  await pagination.getByRole("button", { name: "Page 2", exact: true }).click();
  await expect(page).toHaveURL(/reconcilePage=2/);
  await expect(
    pagination.getByRole("button", { name: "Page 2", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("Matches per page")).toBeHidden();
  const contained = await pagination.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return box.left >= 0 && box.right <= document.documentElement.clientWidth;
  });
  expect(contained).toBe(true);
});
