<script lang="ts">
  import { Transaction, type DirectiveBase } from "@beancount-js/beancount";
  import {
    Amount as ParserAmount,
    Link,
    Position,
    Posting as ParserPosting,
    Tag,
    TransactionDirective,
    formatDate,
    parseNumber,
  } from "@beancount-js/parser";
  import { DateTime } from "luxon";
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Sheet from "$lib/components/ui/sheet";
  import CircleAlert from "lucide-svelte/icons/circle-alert";
  import Minus from "lucide-svelte/icons/minus";
  import Plus from "lucide-svelte/icons/plus";
  import PencilLine from "lucide-svelte/icons/pencil-line";
  import Code2 from "lucide-svelte/icons/code-2";
  import { useContext } from "../context";
  import { LedgerSource } from "../core/ledger";
  import { useStudioWorkspace } from "../studio/workspace";
  import ComboBox from "./ComboBox.svelte";

  type PostingDraft = {
    account: string;
    amount: string;
    currency: string;
  };

  type TransactionDraft = {
    date: string;
    flag: string;
    payee: string;
    narration: string;
    tags: string;
    links: string;
    postings: PostingDraft[];
  };

  export let directive: DirectiveBase;
  export let open = false;

  const { accounts, currencies, ledgerSource } = useContext();
  const { snapshot, saveFile } = useStudioWorkspace();

  let loadedDirective: DirectiveBase | undefined;
  let mode: "form" | "raw" = "raw";
  let rawSource = "";
  let draft: TransactionDraft = emptyDraft();
  let errors: string[] = [];
  let saving = false;

  function emptyDraft(): TransactionDraft {
    return {
      date: "",
      flag: "*",
      payee: "",
      narration: "",
      tags: "",
      links: "",
      postings: [
        { account: "", amount: "", currency: "" },
        { account: "", amount: "", currency: "" },
      ],
    };
  }

  function loadDraft(value: DirectiveBase) {
    rawSource = value.content;
    const sourceDirective = value.source?.directive;
    if (
      value instanceof Transaction &&
      sourceDirective instanceof TransactionDirective
    ) {
      draft = {
        date: formatDate(value.date),
        flag: value.flag || "*",
        payee: value.payee || "",
        narration: value.narration || "",
        tags: value.tags.join(", "),
        links: value.links.join(", "),
        postings: value.postings.map((posting) => ({
          account: posting.account,
          amount: posting.units?.units.toString() ?? "",
          currency: posting.units?.currency ?? "",
        })),
      };
      mode = "form";
    } else {
      draft = emptyDraft();
      mode = "raw";
    }
    errors = [];
  }

  $: if (directive !== loadedDirective) {
    loadedDirective = directive;
    loadDraft(directive);
  }

  function tokens(value: string, prefix: "#" | "^") {
    return [
      ...new Set(
        value
          .split(/[\s,]+/)
          .map((item) => item.trim().replace(prefix, ""))
          .filter(Boolean),
      ),
    ];
  }

  function buildTransactionSource() {
    const sourceDirective = directive.source?.directive;
    if (!(sourceDirective instanceof TransactionDirective)) {
      throw new Error("This transaction has no editable parser source.");
    }
    const date = DateTime.fromISO(draft.date, { zone: "utc" });
    if (!date.isValid) throw new Error("Enter a valid ISO date.");
    const flag = draft.flag.trim();
    if (flag.length > 1)
      throw new Error("The transaction flag must be one character.");
    if (!draft.narration.trim()) throw new Error("Narration is required.");
    if (draft.postings.length < 2)
      throw new Error("Transactions need at least two postings.");

    let inferred = 0;
    const postings = draft.postings.map((posting, index) => {
      const account = posting.account.trim();
      const amount = posting.amount.trim();
      const currency = posting.currency.trim();
      if (!account) throw new Error(`Posting ${index + 1} needs an account.`);
      if (Boolean(amount) !== Boolean(currency)) {
        throw new Error(
          `Posting ${index + 1} needs both an amount and a currency.`,
        );
      }

      let parsedAmount: ParserAmount | null = null;
      if (amount) {
        const value = parseNumber(amount);
        if (!value)
          throw new Error(`Posting ${index + 1} has an invalid amount.`);
        parsedAmount = new ParserAmount(value, currency);
      } else {
        inferred += 1;
      }
      if (inferred > 1)
        throw new Error("Only one posting may have an inferred amount.");

      const existing = sourceDirective.postings[index];
      return existing
        ? existing.copy({ account, amount: parsedAmount })
        : new ParserPosting(new Position(0, 0, 0), "", account, parsedAmount);
    });

    const tags = tokens(draft.tags, "#").map(
      (value) => new Tag(new Position(0, 0, 0), value),
    );
    const links = tokens(draft.links, "^").map(
      (value) => new Link(new Position(0, 0, 0), value),
    );
    return sourceDirective
      .copy({
        date: date.startOf("day"),
        status: flag,
        payee: draft.payee.trim(),
        narrative: draft.narration.trim(),
        tags,
        links,
        postings,
      })
      .toString();
  }

  function errorSignature(error: { message: string }) {
    return error.message;
  }

  async function persist(source: string) {
    const entry = directive.source;
    const currentSnapshot = $snapshot;
    if (!entry || !currentSnapshot) {
      throw new Error(
        "This record is not attached to an editable project file.",
      );
    }
    const path = String(directive.meta["filename"] ?? "");
    const file = currentSnapshot.ledgerFiles.find((item) => item.path === path);
    if (!file)
      throw new Error("The record's source file is no longer available.");

    const original = entry.content;
    const { from, to } = entry.position;
    if (file.contents.slice(from, to) !== original) {
      throw new Error(
        "This record changed in another editor. Reload it before saving.",
      );
    }
    const contents = `${file.contents.slice(0, from)}${source}${file.contents.slice(to)}`;
    const candidate = LedgerSource.fromProject(
      currentSnapshot.project.entryFile,
      currentSnapshot.ledgerFiles.map((item) => ({
        path: item.path,
        contents: item.path === path ? contents : item.contents,
      })),
      $ledgerSource.props,
    );
    const currentErrors = new Set($ledgerSource.errors.map(errorSignature));
    const introduced = candidate.errors.filter(
      (error) => !currentErrors.has(errorSignature(error)),
    );
    if (introduced.length) {
      throw new Error(introduced.map((error) => error.message).join("\n"));
    }
    await saveFile(path, contents);
  }

  async function save() {
    errors = [];
    saving = true;
    try {
      await persist(mode === "form" ? buildTransactionSource() : rawSource);
      open = false;
    } catch (error) {
      errors = [
        error instanceof Error ? error.message : "Unable to save this record.",
      ];
    } finally {
      saving = false;
    }
  }

  function addPosting() {
    draft.postings = [
      ...draft.postings,
      { account: "", amount: "", currency: "" },
    ];
  }

  function removePosting(index: number) {
    if (draft.postings.length <= 2) return;
    draft.postings = draft.postings.filter(
      (_, itemIndex) => itemIndex !== index,
    );
  }
</script>

<Sheet.Root bind:open>
  <Sheet.Content
    side="right"
    class="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
  >
    <Sheet.Header class="border-b px-6 py-5 pr-14">
      <Sheet.Title
        >{mode === "form" ? "Edit transaction" : "Edit record"}</Sheet.Title
      >
      <Sheet.Description>
        {mode === "form"
          ? "Edit the transaction details and postings. Existing costs, prices, comments, and metadata are preserved."
          : "Edit this Beancount source directly."}
      </Sheet.Description>
    </Sheet.Header>

    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      {#if errors.length}
        <Alert.Root variant="destructive" class="mb-5">
          <CircleAlert />
          <Alert.Title>Could not save record</Alert.Title>
          <Alert.Description class="whitespace-pre-wrap"
            >{errors.join("\n")}</Alert.Description
          >
        </Alert.Root>
      {/if}

      {#if mode === "form"}
        <form
          class="flex flex-col gap-6"
          onsubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div class="grid gap-4 sm:grid-cols-3">
            <label
              class="grid gap-2 text-sm font-medium"
              for="transaction-date"
            >
              Date
              <Input
                id="transaction-date"
                type="date"
                bind:value={draft.date}
              />
            </label>
            <label
              class="grid gap-2 text-sm font-medium"
              for="transaction-flag"
            >
              Flag
              <Input
                id="transaction-flag"
                maxlength={1}
                bind:value={draft.flag}
              />
            </label>
            <label
              class="grid gap-2 text-sm font-medium"
              for="transaction-payee"
            >
              Payee
              <Input id="transaction-payee" bind:value={draft.payee} />
            </label>
          </div>

          <label
            class="grid gap-2 text-sm font-medium"
            for="transaction-narration"
          >
            Narration
            <Input
              id="transaction-narration"
              bind:value={draft.narration}
              aria-invalid={!draft.narration.trim()}
            />
          </label>

          <div class="grid gap-4 sm:grid-cols-2">
            <label
              class="grid gap-2 text-sm font-medium"
              for="transaction-tags"
            >
              Tags
              <Input
                id="transaction-tags"
                placeholder="tax, reimbursable"
                bind:value={draft.tags}
              />
            </label>
            <label
              class="grid gap-2 text-sm font-medium"
              for="transaction-links"
            >
              Links
              <Input
                id="transaction-links"
                placeholder="receipt-123"
                bind:value={draft.links}
              />
            </label>
          </div>

          <section
            class="flex flex-col gap-3"
            aria-labelledby="posting-heading"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 id="posting-heading" class="text-sm font-semibold">
                  Postings
                </h3>
                <p class="text-xs text-muted-foreground">
                  Leave one amount and currency pair blank to infer it.
                </p>
              </div>
              <Button size="sm" variant="outline" onclick={addPosting}>
                <Plus data-icon="inline-start" />
                Add posting
              </Button>
            </div>
            {#each draft.postings as posting, index}
              <div class="rounded-lg border bg-muted/30 p-3">
                <div
                  class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto] sm:items-end"
                >
                  <label class="grid gap-2 text-sm font-medium">
                    Account
                    <ComboBox
                      items={() =>
                        $accounts.map((account) => ({
                          label: account,
                          value: account,
                        }))}
                      value={posting.account}
                      placeholder="Select account"
                      onValueChange={(value) =>
                        (draft.postings[index].account = value)}
                    />
                  </label>
                  <label class="grid gap-2 text-sm font-medium">
                    Amount
                    <Input inputmode="decimal" bind:value={posting.amount} />
                  </label>
                  <label class="grid gap-2 text-sm font-medium">
                    Currency
                    <Input
                      list="journal-currencies"
                      bind:value={posting.currency}
                    />
                  </label>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove posting ${index + 1}`}
                    disabled={draft.postings.length <= 2}
                    onclick={() => removePosting(index)}
                  >
                    <Minus />
                  </Button>
                </div>
              </div>
            {/each}
            <datalist id="journal-currencies">
              {#each $currencies as currency}
                <option value={currency}></option>
              {/each}
            </datalist>
          </section>

          <div
            class="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground"
          >
            Advanced posting syntax is retained. Use source mode to change
            costs, prices, comments, or metadata.
          </div>
        </form>
      {:else}
        <label class="grid gap-2 text-sm font-medium" for="record-source">
          Beancount source
          <textarea
            id="record-source"
            class="min-h-[28rem] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            bind:value={rawSource}
          ></textarea>
        </label>
      {/if}
    </div>

    <Sheet.Footer class="border-t px-6 py-4 sm:gap-2">
      {#if mode === "form"}
        <Button type="button" variant="outline" onclick={() => (mode = "raw")}>
          <Code2 data-icon="inline-start" />
          Edit source
        </Button>
      {:else if directive instanceof Transaction}
        <Button type="button" variant="outline" onclick={() => (mode = "form")}>
          <PencilLine data-icon="inline-start" />
          Use form
        </Button>
      {/if}
      <Sheet.Close
        class="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent"
      >
        Cancel
      </Sheet.Close>
      <Button type="button" disabled={saving} onclick={save}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet.Root>
