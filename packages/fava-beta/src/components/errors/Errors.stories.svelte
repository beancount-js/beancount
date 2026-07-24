<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import Errors from "./Errors.svelte";

  const { Story } = defineMeta({
    title: "Fava/Feedback/Ledger Errors",
    component: Errors,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's ledger-validation result table. It makes source errors actionable by preserving their line and directive context; route users here from the application shell rather than duplicating a bespoke error list.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { setContext } from "svelte";
  import { ContextKey, createContext } from "../../context";
  import { LedgerSource } from "../../core/ledger";

  const context = createContext();
  context.ledgerSource.set(
    new LedgerSource(`
      2026-01-01 open Assets:Cash
      2026-01-02 open Assets:Cash
    `),
  );
  setContext(ContextKey, context);
</script>

<Story
  name="Shows actionable ledger validation errors"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByText("Duplicate open directive for Assets:Cash"),
    ).toBeVisible();
    await expect(canvas.getByRole("link", { name: "3" })).toHaveAttribute(
      "href",
      "/editor?line=3",
    );
  }}
>
  {#snippet template()}
    <section
      class="h-80 max-w-3xl overflow-hidden rounded-xl border bg-card shadow-sm"
      aria-label="Ledger validation errors"
    >
      <Errors />
    </section>
  {/snippet}
</Story>
