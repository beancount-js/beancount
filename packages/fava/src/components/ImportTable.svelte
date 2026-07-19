<script lang="ts">
  import Input from "$lib/components/ui/input/input.svelte";
  import Papa from "papaparse";
  import * as Tabs from "$lib/components/ui/tabs";
  import { useLedger } from "./helpers";
  import ComboBox from "./ComboBox.svelte";
  import { filterLedger, Transaction } from "@beancount-js/beancount";
  import { derived } from "svelte/store";
  import { useContext } from "../context";
  import type { Column } from "../grid/grid";
  import { Cell, Grid } from "../grid";
  import EditorDialog from "./EditorDialog.svelte";
  import { Text } from "@codemirror/state";
  import type { Match } from "../import/models";
  import { rawParser as ledgerParser } from "@beancount-js/codemirror-lang-beancount";
  import type { SyntaxNodeRef } from "@lezer/common";
  import { DateTime } from "luxon";
  import { formatDate } from "@beancount-js/parser";
  import { Button, buttonVariants } from "$lib/components/ui/button";
  import { RefreshCcw } from "lucide-svelte";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { importerStore } from "../import/store";
  import type { ImportRow } from "../import/schema";
  import * as Command from "$lib/components/ui/command/index.js";
  import { UploadCloud, Check } from "lucide-svelte";
  import { cn } from "$lib/utils";
  import * as _ from "lodash";

  function notify(message: string) {
    console.info(message);
  }

  interface ImportRecord {
    data: Record<string, any>;
    matches: Array<Match>;
    directive: Transaction | null;
    account: string;
    record: ImportRow;
  }

  interface GroupedRecords {
    categorized: Array<ImportRecord>;
    uncategorized: Array<ImportRecord>;
  }

  const { predicate, importConfig, importFile } = useContext();

  const ledger = useLedger();

  $: accounts = $ledger.accounts
    .filter((it) => it.length)
    .map((it) => ({ label: it, value: it }));

  $: groupedDirectives = derived(
    [importFile, importConfig],
    ([$importFile, $importConfig]) => {
      const groups: GroupedRecords = { categorized: [], uncategorized: [] };
      ($importFile?.data || []).forEach((row) => {
        const account = $importConfig.accountFor(row.data);
        const record: ImportRecord = {
          data: { ...row.data },
          matches: account.determineAccount(row.data),
          directive: $importConfig.directive(row),
          account: row.account,
          record: row,
        };
        record.account ||= record.matches[0]?.value;
        if (record.account === account.defaultAccount) {
          groups.uncategorized.push(record);
        } else {
          groups.categorized.push(record);
        }
      });
      return groups;
    },
  );

  $: filteredDirectives = derived(
    [groupedDirectives, predicate],
    ([$groupedDirectives, $predicate]) => {
      const groups: GroupedRecords = { categorized: [], uncategorized: [] };
      const filter = $predicate.predicate;
      if (!filter) {
        return $groupedDirectives;
      }

      $groupedDirectives.categorized.forEach((record) => {
        const directive = record.directive;
        if (
          directive instanceof Transaction &&
          filterLedger([directive], filter)[0][0].length
        ) {
          groups.categorized.push(record);
        }
      });

      $groupedDirectives.uncategorized.forEach((record) => {
        const directive = record.directive;
        if (
          directive instanceof Transaction &&
          filterLedger([directive], filter)[0][0].length
        ) {
          groups.uncategorized.push(record);
        }
      });

      return groups;
    },
  );

  $: uncategorized = derived([filteredDirectives], ([$filteredDirectives]) => {
    return $filteredDirectives.uncategorized;
  });

  $: categorized = derived([filteredDirectives], ([$filteredDirectives]) => {
    return $filteredDirectives.categorized;
  });

  $: handleChange = (evt: Event) => {
    const target = evt.currentTarget as HTMLInputElement;
    const file = target.files![0];
    const filename = file.name.toLowerCase().trim();
    const files = $importerStore.filter((it) => it.filename !== file.name);

    if (filename.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function (results: Papa.ParseResult<Record<string, any>>) {
          const data = results.data.filter((row) => {
            return Object.keys(row).length >= $importConfig.columns.length;
          });
          const newFile = {
            filename: file.name,
            contents: "",
            data: data.map((it) => {
              return {
                data: it,
                account: "",
                source: "",
              };
            }),
          };
          importFile.set(newFile);
          importerStore.set([newFile, ...files]);
        },
      });
    } else {
      file.text().then((contents) => {
        if (filename.endsWith(".json")) {
          try {
            const entity = JSON.parse(contents);
            if (Array.isArray(entity)) {
              const newFile = {
                filename: file.name,
                contents: "",
                data: entity.map((it) => {
                  return {
                    data: it,
                    account: "",
                    source: "",
                  };
                }),
              };
              importFile.set(newFile);
              importerStore.set([newFile, ...files]);
            } else {
              for (const [key, value] of Object.entries(entity)) {
                if (Array.isArray(value)) {
                  const newFile = {
                    filename: file.name,
                    contents: "",
                    data: value.map((it) => {
                      return {
                        data: it,
                        account: "",
                        source: "",
                      };
                    }),
                  };
                  importFile.set(newFile);
                  importerStore.set([newFile, ...files]);
                  break;
                }
              }
            }
          } catch (e) {
            console.error("Ledger:File", e);
          }
        }
      });
    }
  };

  $: updateAccountName = (row: ImportRecord, value: string) => {
    const account = row.record.account;
    row.record.account = value;

    if (account && row.directive) {
      const doc = Text.of(row.directive.toString().split("\n"));
      const tree = ledgerParser.parse(doc.toString());
      const next = { value: null as Text | null };
      tree.cursor().iterate((node: SyntaxNodeRef) => {
        if (next.value) {
          return false;
        }
        if (
          node.name === "AccountName" &&
          node.node.parent?.name === "Posting" &&
          !node.node.nextSibling
        ) {
          const name = doc.sliceString(node.from, node.to);
          if (name === account) {
            next.value = doc.replace(node.from, node.to, Text.of([value]));
            return false;
          }
        }
      });

      if (next.value) {
        row.record.source = next.value.toString();
      }
    }

    const updated = [
      ...$groupedDirectives.categorized.map((it) => ({ ...it.record })),
      ...$groupedDirectives.uncategorized.map((it) => ({ ...it.record })),
    ];
    const files = [...$importerStore];
    const current = files.find((it) => it.filename === $importFile?.filename);
    if (current) {
      current.data = updated;
      importerStore.set(files);
      importFile.set({ ...current });
    }
  };

  $: model = [
    { id: "", name: "", type: "text", value: (row: any) => "" },
    {
      id: "__account__",
      name: "Account",
      type: "text",
      sortable: true,
      value: (row: any, state: string | undefined) => {
        if (state === "sort") {
          return row.account;
        }
        return [...$ledger.accounts].sort((a, b) => b.length - a.length)[0];
      },
    },
    ...$importConfig.columns.map((column) => {
      const value: Column<any> = {
        id: column.id,
        name: column.name,
        class: "pr-1",
        type: column.type,
        sortable: true,
        value: (row: ImportRecord, state?: string) => {
          if (!row?.data) {
            return "";
          }
          const acc = $importConfig.accountFor(row.data);
          if (column.type === "amount") {
            value.class = "pr-1 text-right";
            return (
              row.directive?.postings.find((it) => it.account === acc.name)
                ?.units ?? _.get(row.data, column.id)
            );
          } else if (column.type === "date") {
            const date: Date = DateTime.fromFormat(
              _.get(row.data, column.id) ?? "",
              $importConfig.dateFormat,
            ).toJSDate();
            if (state === "sort") {
              return date.getTime();
            }
            return formatDate(date);
          }
          return _.get(row.data, column.id);
        },
      };
      return value;
    }),
  ];

  let rowHeight: number = 48;
  let dialogOpen = false;

  function reset() {
    const updated = [
      ...$groupedDirectives.categorized.map((it) => ({ ...it.record })),
      ...$groupedDirectives.uncategorized.map((it) => ({ ...it.record })),
    ].filter((it) => it);
    updated.forEach((it) => {
      it.source = "";
    });
    const files = [...$importerStore];
    const current = files.find((it) => it.filename === $importFile?.filename);
    if (current) {
      current.data = updated;
      current.contents = "";
      importerStore.set(files);
      importFile.set({ ...current });
      dialogOpen = false;
      notify("Successfully reset import data");
    }
  }

  function matches(matches: Match[]) {
    const values = [
      ...new Set(
        (matches || []).filter((it) => it.score > 0).map((it) => it.value),
      ),
    ];
    if (!values.length) {
      return [];
    }
    return [
      {
        group: "Matches",
        items: values.map((it) => ({ label: it, value: it })),
      },
    ];
  }

  function setImportFile(file: string) {
    importFile.set($importerStore.find((it) => it.filename === file) ?? null);
  }
</script>

<div class="">
  <div class="p-2">
    <!-- <div class="flex flex-wrap justify-between w-full">
            <div class="mb-1">
                <Input type="file" on:change={handleChange}/>
            </div>
            <div class="mb-1">
                <ComboBox value={$importFile?.filename} placeholder="Select import file..." items={$importerStore.map(it => ({label: it.filename, value: it.filename}))} onValueChange={setImportFile} />
            </div>
        </div> -->
    <!-- <hr /> -->
    <Tabs.Root
      value={$importFile ? "categorized-records" : "import"}
      class="w-full pt-2"
    >
      <div class="flex items-center justify-between">
        {#if $importFile}
          <Tabs.List>
            <Tabs.Trigger value="categorized-records">Categorized</Tabs.Trigger>
            {#if $uncategorized.length}
              <Tabs.Trigger value="uncategorized-records"
                >Uncategorized</Tabs.Trigger
              >
            {/if}
            <Tabs.Trigger value="import">Import</Tabs.Trigger>
          </Tabs.List>
        {/if}
        {#if $importFile}
          <div>
            {$importFile.filename || ""}
          </div>
          <div>
            <Dialog.Root bind:open={dialogOpen}>
              <Dialog.Trigger
                class={buttonVariants({ variant: "default", size: "sm" })}
              >
                <RefreshCcw class="mr-1 size-4" /> Reset
              </Dialog.Trigger>
              <Dialog.Content class="sm:max-w-[425px]">
                <Dialog.Header>
                  <Dialog.Title class="text-sm">Reset</Dialog.Title>
                  <Dialog.Description>
                    Any custom changes that you have will be deleted on the
                    reset.
                  </Dialog.Description>
                </Dialog.Header>
                <Dialog.Footer>
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    onclick={reset}>Reset</Button
                  >
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Root>
          </div>
        {/if}
      </div>
      <Tabs.Content value="categorized-records" class="font-mono">
        <Grid
          data={categorized}
          height={window.innerHeight - 150}
          padding={window.innerHeight / 2}
          {rowHeight}
          {model}
        >
          <div
            slot="row"
            let:value
            let:size
            let:styles
            let:widths
            class=""
            style={`line-height: ${rowHeight - 4}px`}
          >
            <div style={`line-height: ${rowHeight - 4}px`}>
              <div class="border-b border-l" style={`height: ${size}px`}>
                <p class="h-full">
                  {#each model as column, i}
                    {#if i == 0}
                      <span style={styles[column.id]} class="border-r">
                        <EditorDialog
                          directive={value.directive}
                          class="mr-1"
                        />
                      </span>
                    {:else if i == 1}
                      <span style={styles[column.id]} class="border-r">
                        <ComboBox
                          class="font-mono"
                          value={value.account}
                          groups={matches(value.matches)}
                          items={accounts}
                          onValueChange={(opt) => updateAccountName(value, opt)}
                        />
                      </span>
                    {:else}
                      <Cell
                        class={column.class}
                        style={styles[column.id]}
                        value={column.value(value)}
                        type={column.type}
                        height={rowHeight}
                      ></Cell>
                    {/if}
                  {/each}
                </p>
              </div>
            </div>
          </div>
        </Grid>
      </Tabs.Content>
      <Tabs.Content value="uncategorized-records">
        <Grid
          data={uncategorized}
          height={window.innerHeight - 150}
          padding={window.innerHeight / 2}
          {rowHeight}
          {model}
        >
          <div
            slot="row"
            let:value
            let:size
            let:styles
            let:widths
            class=""
            style={`line-height: ${rowHeight - 4}px`}
          >
            <div style={`line-height: ${rowHeight - 4}px`}>
              <div class="border-b border-l" style={`height: ${size}px`}>
                <p class="h-full">
                  {#each model as column, i}
                    {#if i == 0}
                      <span style={styles[column.id]} class="border-r">
                        <EditorDialog
                          directive={value.directive}
                          class="mr-1"
                        />
                      </span>
                    {:else if i == 1}
                      <span style={styles[column.id]} class="border-r">
                        <ComboBox
                          class="font-mono"
                          groups={matches(value.matches)}
                          value={value.account}
                          items={accounts}
                          onValueChange={(opt) => updateAccountName(value, opt)}
                        />
                      </span>
                    {:else}
                      <Cell
                        class={column.class}
                        style={styles[column.id]}
                        value={column.value(value)}
                        type={column.type}
                        height={rowHeight}
                      ></Cell>
                    {/if}
                  {/each}
                </p>
              </div>
            </div>
          </div>
        </Grid>
      </Tabs.Content>
      <Tabs.Content value="import">
        <div class="relative p-2">
          <div class="flex w-full items-center justify-center">
            <label
              for="dropzone-file"
              class="flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed hover:bg-secondary/60"
            >
              <div class="flex flex-col items-center justify-center pb-7">
                <UploadCloud />
                <p class="mb-2 text-sm text-gray-500 dark:text-gray-400">
                  <span class="font-semibold">Click to upload</span> or drag and
                  drop
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  CSV, JSON, or YAML
                </p>
              </div>
              <input
                id="dropzone-file"
                type="file"
                on:change={handleChange}
                class="hidden"
              />
            </label>
          </div>
          <div class="absolute -bottom-16 flex w-full justify-center">
            <Command.Root class="max-w-[450px] rounded-lg border shadow-md">
              <Command.Input
                class="[&&]:border-none [&&]:shadow-none [&&]:focus:shadow-none"
                placeholder="Type to search for file..."
              />
              <Command.List>
                <Command.Empty>No files found.</Command.Empty>
                <Command.Group heading="Files">
                  {#each $importerStore as file}
                    <Command.Item
                      value={file.filename}
                      onSelect={() => importFile.set(file)}
                    >
                      <Check
                        class={cn(
                          "mr-2 h-4 w-4",
                          $importFile?.filename !== file.filename &&
                            "text-transparent",
                        )}
                      />
                      <span>{file.filename}</span>
                    </Command.Item>
                  {/each}
                </Command.Group>
              </Command.List>
            </Command.Root>
          </div>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  </div>
</div>
