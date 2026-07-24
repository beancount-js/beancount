<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import type { DirectiveBase } from "@beancount-js/beancount";
  import { parseDirectives } from "@beancount-js/beancount";
  import JournalEditorSheet from "./JournalEditorSheet.svelte";
  import type { MerchantPickerMerchant } from "./MerchantPicker.svelte";
  import * as Tooltip from "../shadcn/tooltip";
  import { directiveKind } from "./journal-editor/directive-draft";

  const { Story } = defineMeta({
    title: "UI Forms/Journal Editor Sheet",
    component: JournalEditorSheet,
    parameters: {
      docs: {
        description: {
          component:
            "Shared presentation for editing Beancount journal directives. Callers provide raw context (directive, accounts, tags, currencies, merchants, persistence callbacks).",
        },
      },
    },
  });

  const sampleMerchants: readonly MerchantPickerMerchant[] = [
    {
      merchantId: "merchant:coffee",
      canonicalName: "Northstar Cafe",
      domain: "northstar-cafe.com",
      description: "Coffee and pastries.",
    },
    {
      merchantId: "merchant:grocery",
      canonicalName: "Daily Grocer",
      domain: "daily-grocer.com",
    },
  ];

  const directiveFixtures = [
    {
      kind: "transaction",
      source:
        '2010-01-01 * "Northstar Cafe" "Lunch"\n  Expenses:Food  12.00 USD\n  Assets:Cash  -12.00 USD\n',
      label: "transaction",
      name: "Transaction",
    },
    {
      kind: "open",
      source: "2010-01-01 open Assets:Checking USD STRICT\n",
      label: "open",
      name: "Open account",
    },
    {
      kind: "note",
      source: '2010-01-01 note Assets:Checking "Lunch at office"\n',
      label: "note",
      name: "Note",
    },
  ] as const;

  type DirectiveFixture = (typeof directiveFixtures)[number];

  function directiveForSource(fixture: DirectiveFixture): DirectiveBase {
    const [directives] = parseDirectives(
      `2010-01-01 option "operating_currency" "USD"\n${fixture.source}`,
      {
        filename: "journal-editor-story.beancount",
        transform: true,
      },
    );
    const directive = directives.find(
      (entry) => directiveKind(entry) === fixture.kind,
    );
    if (!directive) {
      throw new Error("Story fixture failed to parse.");
    }
    return directive;
  }

  const directives = directiveFixtures.map((fixture) => ({
    ...fixture,
    directive: directiveForSource(fixture),
  }));

  const transactionDirective = directives.find(
    (directiveFixture) => directiveFixture.label === "transaction",
  )?.directive;

  if (!transactionDirective) {
    throw new Error("Expected transaction fixture directive to parse.");
  }
</script>

<script lang="ts">
  let open = $state(false);
</script>

<Story
  name="Edits a transaction directive and flags pending changes"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Open transaction editor" }),
    );
    const dialog = within(document.body).getByRole("dialog");
    const narration = within(dialog).getByRole("textbox", {
      name: "Narration",
    });
    await userEvent.clear(narration);
    await userEvent.type(narration, "Team dinner");
    await expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Unsaved changes…",
    );
  }}
>
  {#snippet template()}
    <Tooltip.Provider delayDuration={0}>
      <div class="space-y-3">
        <button
          type="button"
          class="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3"
          onclick={() => {
            open = true;
          }}
        >
          Open transaction editor
        </button>
        <JournalEditorSheet
          bind:open
          directive={transactionDirective!}
          accounts={["Assets:Cash", "Expenses:Food", "Income:Salary"]}
          currencies={["USD", "GBP"]}
          tags={["work", "lunch"]}
          merchants={sampleMerchants}
          merchantLabel="Merchant"
          merchantAriaLabel="Merchant"
          merchantEmptyOption={{
            label: "No merchant selected",
            description: "Use the account's colour and icon instead.",
          }}
          onSave={() => {}}
        />
      </div>
    </Tooltip.Provider>
  {/snippet}
</Story>

<Story name="Also renders open and note kinds">
  {#snippet template()}
    <Tooltip.Provider delayDuration={0}>
      <div class="space-y-4">
        {#each directives as fixture}
          <details class="rounded border p-2">
            <summary class="cursor-pointer">{fixture.name}</summary>
            <JournalEditorSheet
              directive={fixture.directive}
              open={false}
              accounts={["Assets:Cash", "Assets:Checking", "Expenses:Food"]}
              currencies={["USD"]}
              tags={["migration"]}
              merchants={sampleMerchants}
              merchantLabel="Merchant"
              merchantAriaLabel="Merchant"
            />
          </details>
        {/each}
      </div>
    </Tooltip.Provider>
  {/snippet}
</Story>
