<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import ReviewDiff from "./ReviewDiff.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Review Diff",
    component: ReviewDiff,
    parameters: {
      docs: {
        description: {
          component:
            "A source-agnostic, read-only change review. Supply the current and proposed source text, then keep approval, rejection, persistence, and AI or import workflows in the application. See the [Form guidance](?path=/docs/ui-forms-guidance--docs).",
        },
      },
    },
  });

  const before = `2026-07-18 * "Northstar Market"
  Expenses:Groceries  42.17 GBP
  Assets:Cash`;

  const after = `2026-07-18 * "Northstar Market"
  Expenses:Food  42.17 GBP
  Assets:Card`;
</script>

<Story
  name="Highlights additions, removals, and replacement words"
  play={async ({ canvas }) => {
    const diff = canvas.getByRole("region", { name: "Transaction change" });
    await expect(diff).toHaveTextContent("Expenses:Groceries");
    await expect(diff).toHaveTextContent("Expenses:Food");
    await expect(
      canvas.getAllByText("Assets:Card", { selector: "span" }).at(-1),
    ).toHaveAttribute("data-review-diff-segment", "added");
  }}
>
  {#snippet template()}
    <div class="max-w-3xl p-5">
      <ReviewDiff {before} {after} ariaLabel="Transaction change" />
    </div>
  {/snippet}
</Story>

<Story
  name="Explains when a proposed source has no changes"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText("No source changes to review."),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <div class="max-w-3xl p-5">
      <ReviewDiff {before} after={before} />
    </div>
  {/snippet}
</Story>
