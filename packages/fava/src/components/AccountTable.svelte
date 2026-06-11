<script lang="ts">
  import { formatDate } from "@beancount-js/parser";
  import {
    Balance,
    Close,
    isInstanceOf,
    Open,
    Pad,
    sorted,
    Transaction,
    type Directive,
    type MissingType,
  } from "@beancount-js/beancount";
  import { useContext } from "../context";
  import { AccountFilter } from "@beancount-js/filters";
  import { useCtx } from "../stores/format";
  import { accountBalances, accountChanges, chunk, useLedger } from "./helpers";
  import { urlForAccount, urlForDate } from "../helpers";
  import { derived, writable } from "svelte/store";
  import EditorDialog from "./EditorDialog.svelte";
  import type { Column } from "../grid/grid";
  import { Amount } from "@beancount-js/beancount";
  import { Grid } from "../grid";
  import { UnfoldVertical, FoldVertical } from "lucide-svelte";
  import { ValidationError } from "@beancount-js/beancount";
  import type { ParseError } from "@beancount-js/parser";
  import type { Text } from "@codemirror/state";
  const { conversion } = useContext();
  const ctx = useCtx();

  export let account: string;
  export let rowHeight: number = 24;
  export let onValueChange:
    | ((
        content: Text,
        directive: Directive,
      ) => Array<ValidationError | ParseError>)
    | undefined = undefined;

  $: ledgerData = useLedger(AccountFilter.of(account));
  $: balances = $ledgerData.accountBalanceByDate($conversion, account);
  $: changes = $ledgerData.accountChangesByDate($conversion, account);
  const toggled = writable<Set<string>>(new Set<string>());
  $: data = derived([ledgerData, toggled], ([$ledgerData]) => {
    return $ledgerData.directives
      .filter((it) => isInstanceOf(it, Transaction, Pad, Balance, Open, Close))
      .reverse();
  });

  const model: Array<Column<any>> = [
    {
      id: "date",
      name: "Date",
      type: "date",
      class: "border-solid border-r",
      sortable: true,
      value: (row) => formatDate(row.date),
    },
    {
      id: "flag",
      name: "F",
      type: "text",
      class: "border-solid border-r",
      sortable: true,
      value: (row) => row.flag,
    },
    {
      id: "account",
      name: "Account",
      type: "account",
      class: "border-solid border-r",
      sortable: true,
      value: (row: Transaction) => {
        const postings = row.postings || [];
        const data = Array.from(
          { length: Math.ceil(postings.length / 10) },
          () => "-",
        );
        if (!data.length && row.accounts.length) {
          data.push([...row.accounts].sort((a, b) => b.length - a.length)[0]);
        }
        if (Array.isArray(row.tags) && row.tags.length) {
          data.push([...row.tags].sort((a, b) => b.length - a.length)[0]);
        }
        if (Array.isArray(row.links) && row.links.length) {
          data.push([...row.links].sort((a, b) => b.length - a.length)[0]);
        }
        if ($toggled.has(row.id)) {
          return data;
        }
        data.push(...postings.map((it) => it.account));
        return data;
      },
    },
    {
      id: "units",
      name: "Units",
      type: "amount",
      class: "border-solid border-r text-right",
      value: (row: any) => {
        if (row instanceof Transaction) {
          const data: any[] = Array.from(
            { length: Math.ceil(row.postings.length / 10) },
            () => "-".repeat(10),
          );
          if ($toggled.has(row.id)) {
            return data;
          }
          data.push(...(row.postings || []).map((it) => it.units));
          return data;
        } else if (row instanceof Balance) {
          return row.amount;
        }
        return [];
      },
    },
    {
      id: "cost",
      name: "Cost / Change",
      type: "amount",
      class: "border-solid border-r text-right",
      value: (row: Directive) => {
        const data: Array<Amount | MissingType> = [];
        for (const [currency, value] of Object.entries(
          changes[formatDate(row.date)] || {},
        )) {
          data.push(new Amount(value, currency));
        }

        if ($toggled.has(row.id)) {
          return data;
        }
        if (row instanceof Transaction) {
          data.push(...(row.postings || []).map((it) => it.units));
        }
        return data;
      },
    },
    {
      id: "price",
      name: "Price / Balance",
      type: "amount",
      class: "border-solid text-right border-r",
      value: (row: Directive) => {
        const data: Array<Amount | MissingType> = [];
        for (const [currency, value] of Object.entries(
          balances[formatDate(row.date)] || {},
        )) {
          data.push(new Amount(value, currency));
        }
        if ($toggled.has(row.id)) {
          return data;
        }
        if (row instanceof Transaction) {
          data.push(...(row.postings || []).map((it) => it.units));
        }
        return data;
      },
    },
  ];

  function handleToggle(evt: MouseEvent, tx: Transaction) {
    evt.preventDefault();
    toggled.update((t) => {
      const newSet = new Set(t);
      const isToggled = newSet.has(tx.id);
      if (isToggled) {
        newSet.delete(tx.id);
      } else {
        newSet.add(tx.id);
      }
      return newSet;
    });
  }

  $: balanceChanges = accountBalances(
    $ledgerData.directives,
    account,
    $conversion,
  );
  $: now = new Date();

  function dateToMillis(date: {
    toMillis?: () => number;
    getTime?: () => number;
  }) {
    return date.toMillis?.() ?? date.getTime?.() ?? 0;
  }
</script>

<div class="">
  <div class="table-h-scroll w-full max-w-full">
    <Grid
      height={window.innerHeight - 150}
      padding={window.innerHeight / 2}
      {rowHeight}
      heightDiff={3}
      {data}
      {model}
    >
      <svelte:fragment slot="header" let:column>
        {#if column.id == "date" && $data.length}
          {#if !$toggled.size}
            <button
              class="clickable-icon view-action inline-block"
              aria-label="Unfold All"
              on:click={(evt) => {
                evt.preventDefault();
                evt.stopImmediatePropagation();
                evt.stopPropagation();
                toggled.set(new Set($ledgerData.directives.map((it) => it.id)));
              }}
            >
              <UnfoldVertical />
            </button>
          {:else}
            <button
              class="clickable-icon view-action inline-block"
              aria-label="Fold All"
              on:click={(evt) => {
                evt.preventDefault();
                evt.stopImmediatePropagation();
                evt.stopPropagation();
                toggled.set(new Set());
              }}
            >
              <FoldVertical />
            </button>
          {/if}
          {column.name}
        {:else}
          {column.name}
        {/if}
      </svelte:fragment>
      <div
        slot="row"
        class:opacity-45={value.date &&
          dateToMillis(value.date) > now.getTime()}
        let:value
        let:size
        let:styles
        let:widths
        class=""
        style={`line-height: ${rowHeight - 4}px`}
      >
        {@const directive = value}
        {#if directive instanceof Transaction}
          <li
            class="transaction cleared border-b border-l border-solid"
            style={`height: ${size}px`}
          >
            <p
              style={`height: ${$toggled.has(directive.id) ? size : size - directive.postings.length * rowHeight}px`}
            >
              <span class="datecell" style={styles.date}>
                <a href={urlForDate(directive.date)}
                  >{formatDate(directive.date)}</a
                >
                <EditorDialog {directive} {onValueChange} />
              </span>
              <span class="flag" style={`${styles.flag}`}>{directive.flag}</span
              >
              <span
                aria-label={`${directive.payee || ""} ${directive.narration || ""}`.trim()}
                class="description droptarget overflow-hidden text-ellipsis text-nowrap"
                style={`width: ${widths.account}px`}
              >
                <strong class="payee">{directive.payee}</strong>
                {#if directive.narration}
                  <span class="separator"></span>{directive.narration}
                {/if}
              </span>
              {#if directive.tags.length + directive.tags.length > 0}
                <div
                  class="absolute left-1 overflow-hidden py-1"
                  style={`height: ${rowHeight * [directive.tags.length, directive.links.length].filter((it) => it > 0).length}px; top: ${rowHeight}px; width: ${widths.date + widths.flag + widths.account + (directive.postings.length < 10 ? widths.units : 0)}px;`}
                >
                  {#each directive.tags as tag}
                    <a href={`?query=%23${tag}`} class="mr-1"
                      ><span class="cm-hashtag cm-hashtag-begin">#</span><span
                        class="cm-hashtag cm-hashtag-end">{tag}</span
                      ></a
                    >
                  {/each}
                  {#each directive.links as link}
                    <a href={`?query=^${link}`} class="mr-1"
                      ><span class="cm-link">^</span><span
                        class="cm-link hover:underline">{link}</span
                      ></a
                    >
                  {/each}
                </div>
              {/if}
              <span class="border-r" style={styles.units}>
                <button
                  type="button"
                  class="block h-auto w-full"
                  on:click={(evt) => handleToggle(evt, directive)}
                >
                  {#each chunk([...directive.postings], 10) as batch}
                    <div
                      class="indicators w-full"
                      style="height: 24px; padding: 5px 0;"
                    >
                      {#each batch as p}
                        <span class="!bg-foreground"></span>
                      {/each}
                    </div>
                  {/each}
                </button>
              </span>
              <span class="num dimmed border-r" style={styles.cost}>
                {#each Object.entries(accountChanges(directive, account, $conversion)) as [currency, num]}
                  <span class="block">{$ctx.money(num, currency)}</span>
                {/each}
              </span>
              <span class="num border-r" style={styles.price}>
                {#each Object.entries(balanceChanges[directive.id]?.balance || {}) as [currency, num]}
                  <span class="block">{$ctx.money(num, currency)}</span>
                {/each}
              </span>
            </p>
            {#if !$toggled.has(directive.id)}
              <ul class="postings h-full border-t">
                {#each directive.postings as posting}
                  <li>
                    <p>
                      <span class="datecell" style={styles.date}></span>
                      <span class="flag" style={styles.flag}
                        >{posting.flag}</span
                      >
                      <span
                        class="description droptarget"
                        style={styles.account}
                        ><a href={urlForAccount(posting.account)}
                          >{posting.account}</a
                        ></span
                      >
                      <span class="num border-l border-r" style={styles.units}
                        >{$ctx.money(posting.units)}</span
                      >
                      <span class="num dimmed border-r" style={styles.cost}
                      ></span>
                      <span class="num border-r" style={styles.price}></span>
                    </p>
                  </li>
                {/each}
              </ul>
            {/if}
          </li>
        {:else if directive instanceof Open}
          <li class="border-b border-l" style={`height: ${size}px`}>
            <p class="h-full">
              <span class="datecell" style={styles.date}>
                <a href={urlForDate(directive.date)}
                  >{formatDate(directive.date)}</a
                >
                <EditorDialog {directive} {onValueChange} />
              </span>
              <span class="flag" style={styles.flag}
                >{directive.directiveType.toLocaleLowerCase()}</span
              >
              <span
                class="description droptarget border-r"
                style={`width: ${widths.account + widths.units + widths.cost + widths.price}px`}
              >
                <a href={urlForAccount(directive.account)}
                  >{directive.account}</a
                >
              </span>
            </p>
          </li>
        {:else if directive instanceof Pad}
          <li class="border-b border-l" style={`height: ${size}px`}>
            <p class="h-full">
              <span class="datecell" style={styles.date}>
                <a href={urlForDate(directive.date)}
                  >{formatDate(directive.date)}</a
                >
                <EditorDialog {directive} {onValueChange} />
              </span>
              <span class="flag" style={styles.flag}
                >{directive.directiveType.toLocaleLowerCase()}</span
              >
              <span
                class="description droptarget border-r"
                style={`width: ${widths.account + widths.units + widths.cost + widths.price}px`}
              >
                <a href={urlForAccount(directive.sourceAccount)}
                  >{directive.sourceAccount}</a
                >
                &nbsp;from&nbsp;
                <a href={urlForAccount(directive.account)}
                  >{directive.account}</a
                >
              </span>
            </p>
          </li>
        {:else if directive instanceof Balance}
          <li class="border-b border-l" style={`height: ${size}px`}>
            <p class="h-full">
              <span class="datecell" style={styles.date}>
                <a href={urlForDate(directive.date)}
                  >{formatDate(directive.date)}</a
                >
                <EditorDialog {directive} {onValueChange} />
              </span>
              <span class="flag" style={styles.flag}>Bal</span>
              <span class="description droptarget" style={styles.account}>
                <a href={urlForAccount(directive.account)}
                  >{directive.account}</a
                >
              </span>
              <span
                class="num bal border-l border-r"
                style={styles.units}
                title="">{$ctx.money(directive.amount)}</span
              >
              <span
                class="border-r"
                style={`width: ${widths.cost + widths.price}px`}
              ></span>
            </p>
          </li>
        {/if}
      </div>
    </Grid>
  </div>
</div>
