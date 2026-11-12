<script lang="ts">
  import { ArrowLeftRight } from "@lucide/svelte";
  import { BookOpen } from "@lucide/svelte";
  import { DatabaseZap } from "@lucide/svelte";
  import { ChevronsDownUp } from "@lucide/svelte";
  import { ChevronsUpDown } from "@lucide/svelte";
  import { ClipboardList } from "@lucide/svelte";
  import { Check } from "@lucide/svelte";
  import { FoldVertical } from "@lucide/svelte";
  import { Landmark } from "@lucide/svelte";
  import { Pencil } from "@lucide/svelte";
  import { Play } from "@lucide/svelte";
  import { Plus } from "@lucide/svelte";
  import { RefreshCw } from "@lucide/svelte";
  import { Save } from "@lucide/svelte";
  import { Settings2 } from "@lucide/svelte";
  import { Store } from "@lucide/svelte";
  import { UnfoldVertical } from "@lucide/svelte";
  import { FormToolbar } from "@lapismd/design-core/forms";
  import CycleSelect from "./CycleSelect.svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import { Switch } from "@lapismd/design-core/shadcn/switch";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import { useIngestionHeaderActions } from "../studio/ingestion-header-actions";
  const ingestionHeaderActions = useIngestionHeaderActions();

  let {
    region = "actions",
  }: {
    /** Leading sits beside the page title; actions stay in the right cluster. */
    region?: "leading" | "actions";
  } = $props();
</script>

{#if $ingestionHeaderActions}
  {@const header = $ingestionHeaderActions}
  {#if region === "leading"}
    {#if header.kind === "ledger"}
      <div
        role="toolbar"
        aria-label="Editor commands"
        class="h-8 space-x-0 rounded-none border-0 bg-transparent p-0 shadow-none"
      >
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            class="h-8 cursor-pointer px-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >File</DropdownMenu.Trigger
          >
          <DropdownMenu.Content class="!w-max min-w-44 whitespace-nowrap">
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger class="pl-8"
                >Open source</DropdownMenu.SubTrigger
              >
              <DropdownMenu.SubContent
                class="!w-max min-w-44 whitespace-nowrap"
              >
                {#each header.sources as file (file.path)}
                  <DropdownMenu.CheckboxItem
                    checked={file.path === header.activePath}
                    onclick={() => header.onOpenSource(file.path)}
                    >{file.path}</DropdownMenu.CheckboxItem
                  >
                {/each}
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
            <DropdownMenu.CheckboxItem
              checked={header.formatOnSave}
              onclick={() => header.onToggleFormatOnSave()}
            >
              Format on Save
            </DropdownMenu.CheckboxItem>
            <DropdownMenu.Item
              inset
              class="justify-start whitespace-nowrap text-left"
              onclick={() => header.onGotoLine()}>Go To Line</DropdownMenu.Item
            >
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            class="h-8 cursor-pointer px-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >Edit</DropdownMenu.Trigger
          >
          <DropdownMenu.Content class="!w-max min-w-48 whitespace-nowrap">
            <DropdownMenu.Item
              inset
              class="whitespace-nowrap"
              onclick={() => header.onFormat()}
            >
              Format <DropdownMenu.Shortcut class="pl-2"
                >⌘ + D</DropdownMenu.Shortcut
              >
            </DropdownMenu.Item>
            <DropdownMenu.Item
              inset
              class="whitespace-nowrap"
              onclick={() => header.onToggleComment()}
            >
              Toggle Comment <DropdownMenu.Shortcut class="pl-2"
                >⌘ + /</DropdownMenu.Shortcut
              >
            </DropdownMenu.Item>
            <DropdownMenu.Item
              class="whitespace-nowrap"
              onclick={() => header.onUnfoldAll()}
            >
              <UnfoldVertical class="mr-2 size-4" /> Open all folds
            </DropdownMenu.Item>
            <DropdownMenu.Item
              class="whitespace-nowrap"
              onclick={() => header.onFoldAll()}
            >
              <FoldVertical class="mr-2 size-4" /> Close all folds
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger class="pl-8"
                >Find</DropdownMenu.SubTrigger
              >
              <DropdownMenu.SubContent
                class="!w-max min-w-36 whitespace-nowrap"
              >
                <DropdownMenu.Item onclick={() => header.onFind()}
                  >Find...</DropdownMenu.Item
                >
                <DropdownMenu.Item onclick={() => header.onFindNext()}
                  >Find Next</DropdownMenu.Item
                >
                <DropdownMenu.Item onclick={() => header.onFindPrevious()}
                  >Find Previous</DropdownMenu.Item
                >
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    {/if}
  {:else}
    <div
      class="flex w-max flex-nowrap items-center justify-end gap-2 sm:w-auto sm:flex-wrap"
      data-slot="ingestion-header-actions"
    >
      {#if header.kind === "review"}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label="Open active review ledger"
                disabled={!header.canOpenLedger}
                onclick={() => header.onOpenLedger()}
              >
                <BookOpen />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Open active review ledger</Tooltip.Content>
        </Tooltip.Root>
        {#if header.bulkAction}
          {@const bulkAction = header.bulkAction}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  size="sm"
                  class="h-8 gap-1.5"
                  aria-label={`${bulkAction.label} ${bulkAction.selectedCount} selected item${bulkAction.selectedCount === 1 ? "" : "s"}`}
                  disabled={!bulkAction.canRun || bulkAction.busy}
                  onclick={() => bulkAction.onRun()}
                >
                  <Check data-icon="inline-start" />
                  {bulkAction.busy
                    ? `${bulkAction.label}…`
                    : `${bulkAction.label} ${bulkAction.selectedCount}`}
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>
              {bulkAction.label} selected items
            </Tooltip.Content>
          </Tooltip.Root>
        {:else}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  size="sm"
                  class="h-8"
                  aria-label={header.acceptBusy
                    ? "Accepting ready transactions"
                    : header.acceptCount
                      ? `Accept ${header.acceptCount} ready transaction${header.acceptCount === 1 ? "" : "s"}`
                      : "Accept ready transactions"}
                  disabled={!header.canAccept || header.acceptBusy}
                  onclick={() => header.onAccept()}
                >
                  {#if header.acceptBusy}
                    Accepting…
                  {:else}
                    Accept{header.acceptCount ? ` ${header.acceptCount}` : ""}
                  {/if}
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>
              {header.acceptBusy
                ? "Accepting…"
                : header.acceptCount
                  ? `Write ${header.acceptCount} ready transaction${header.acceptCount === 1 ? "" : "s"} to the ledger`
                  : "No transactions ready to accept"}
            </Tooltip.Content>
          </Tooltip.Root>
        {/if}
        <CycleSelect
          value={header.sourceId}
          options={header.sourceOptions}
          label="Source"
          ariaLabel="Select source"
          onChange={header.onSourceChange}
        />
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label={header.groupsCollapsedAll
                  ? "Expand all date groups"
                  : "Collapse all date groups"}
                onclick={(event) => {
                  header.onToggleCollapseGroups();
                }}
              >
                {#if header.groupsCollapsedAll}
                  <ChevronsUpDown />
                {:else}
                  <ChevronsDownUp />
                {/if}
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>
            {header.groupsCollapsedAll
              ? "Expand all date groups"
              : "Collapse all date groups"}
          </Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label="Review merchants"
                onclick={(event) => {
                  header.onReviewMerchants();
                }}
              >
                <Store />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Review merchants</Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label="Open Accounts"
                onclick={(event) => {
                  header.onOpenAccounts();
                }}
              >
                <Landmark />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Open Accounts</Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label="Force re-fetch"
                title="Prefer Sync on the Accounts screen"
                disabled={!header.canForceRefetch}
                onclick={(event) => {
                  header.onForceRefetch();
                }}
              >
                <RefreshCw />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Force re-fetch</Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label="Edit sources"
                onclick={(event) => {
                  header.onEditSources();
                }}
              >
                <Settings2 />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Edit sources</Tooltip.Content>
        </Tooltip.Root>
      {:else if header.kind === "merchants"}
        <CycleSelect
          value={header.sourceId}
          options={header.sourceOptions}
          label="Source"
          ariaLabel="Select source"
          onChange={header.onSourceChange}
        />
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label={header.groupsCollapsedAll
                  ? "Expand all merchant groups"
                  : "Collapse all merchant groups"}
                onclick={(event) => {
                  header.onToggleCollapseGroups();
                }}
              >
                {#if header.groupsCollapsedAll}
                  <ChevronsUpDown />
                {:else}
                  <ChevronsDownUp />
                {/if}
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>
            {header.groupsCollapsedAll
              ? "Expand all merchant groups"
              : "Collapse all merchant groups"}
          </Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label="Review imports"
                onclick={(event) => {
                  header.onReviewImports();
                }}
              >
                <ClipboardList />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Review imports</Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label="Open Accounts"
                onclick={(event) => {
                  header.onOpenAccounts();
                }}
              >
                <Landmark />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Open Accounts</Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label="Edit sources"
                onclick={(event) => {
                  header.onEditSources();
                }}
              >
                <Settings2 />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Edit sources</Tooltip.Content>
        </Tooltip.Root>
      {:else if header.kind === "history"}
        <CycleSelect
          value={header.sourceId}
          options={header.sourceOptions}
          label="Source"
          ariaLabel="Select source"
          onChange={header.onSourceChange}
        />
      {:else if header.kind === "manage-merchants"}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="sm"
                variant="ghost"
                class="h-8 gap-1.5 px-2.5"
                aria-label="Backfill merchants from ledger"
                disabled={header.backfillBusy}
                onclick={(event) => {
                  header.onBackfill();
                }}
              >
                <DatabaseZap class="size-4" aria-hidden="true" />
                <span class="text-sm"
                  >{header.backfillBusy ? "Backfilling…" : "Backfill"}</span
                >
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content
            >Create merchant profiles for imported transactions missing
            merchant_id</Tooltip.Content
          >
        </Tooltip.Root>
      {:else if header.kind === "accounts"}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="sm"
                variant="outline"
                aria-label={header.syncAllBusy
                  ? "Syncing all connections"
                  : "Sync all connections"}
                disabled={!header.canSyncAll || header.syncAllBusy}
                onclick={() => header.onSyncAll()}
              >
                <RefreshCw
                  data-icon="inline-start"
                  class={header.syncAllBusy ? "animate-spin" : ""}
                />
                {header.syncAllBusy ? "Syncing…" : "Sync all"}
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>
            {header.syncAllBusy
              ? "Syncing configured connections…"
              : header.canSyncAll
                ? "Sync all configured connections"
                : "Link an account before syncing"}
          </Tooltip.Content>
        </Tooltip.Root>
      {:else if header.kind === "rules"}
        {#if header.saveHint}
          <p class="text-xs text-muted-foreground" role="status">
            {header.saveHint}
          </p>
        {/if}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label="Apply all"
                disabled={!header.canApplyAll || header.applyBusy}
                onclick={(event) => {
                  header.onApplyAll();
                }}
              >
                <Play />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Apply all</Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label="Add rule"
                onclick={(event) => {
                  header.onAddRule();
                }}
              >
                <Plus />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Add rule</Tooltip.Content>
        </Tooltip.Root>
      {:else if header.kind === "account-activity"}
        {#if header.selectedCount > 0}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  size="sm"
                  variant="ghost"
                  class="h-8 gap-1.5 px-2.5"
                  aria-label={`Edit ${header.selectedCount} selected records`}
                  onclick={(event) => {
                    header.onReplace();
                  }}
                >
                  <ArrowLeftRight class="size-4" />
                  <span class="text-sm">Edit ({header.selectedCount})</span>
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>Edit selection</Tooltip.Content>
          </Tooltip.Root>
        {/if}
      {:else if header.kind === "ledger"}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label="Save ledger"
                disabled={!header.dirty}
                onclick={(event) => {
                  header.onSave();
                }}
              >
                <Save />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Save ledger</Tooltip.Content>
        </Tooltip.Root>
      {:else if header.kind === "editor"}
        {#if header.saveHint}
          <p class="text-xs text-muted-foreground" role="status">
            {header.saveHint}
          </p>
        {/if}
        {#if header.configReady && header.previewMode && !header.yamlMode}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={header.syncAllBusy
                    ? "Syncing all connections"
                    : "Sync all connections"}
                  disabled={!header.canSyncAll || header.syncAllBusy}
                  onclick={() => {
                    header.onSyncAll();
                  }}
                >
                  <RefreshCw
                    data-icon="inline-start"
                    class={header.syncAllBusy ? "animate-spin" : ""}
                  />
                  {header.syncAllBusy ? "Syncing…" : "Sync all"}
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>
              {header.syncAllBusy
                ? "Syncing configured connections…"
                : header.canSyncAll
                  ? "Sync all configured connections"
                  : "Configure a connection before syncing"}
            </Tooltip.Content>
          </Tooltip.Root>
        {/if}
        {#if header.configReady && !header.yamlMode && !header.previewMode}
          <FormToolbar
            collapsedAll={header.sectionsCollapsedAll}
            collapseLabel="Collapse all source sections"
            expandLabel="Expand all source sections"
            onToggleCollapse={header.onToggleCollapse}
          />
        {/if}
        {#if header.configReady}
          <div class="flex items-center gap-2">
            <Switch
              id="ingestion-yaml-mode"
              size="sm"
              checked={header.yamlMode}
              aria-label="YAML mode"
              onCheckedChange={header.onYamlMode}
            />
            <label for="ingestion-yaml-mode" class="text-sm font-semibold"
              >YAML</label
            >
          </div>
          {#if !header.yamlMode}
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    type="button"
                    size="icon"
                    variant="ghost"
                    class="size-8"
                    aria-label={header.previewMode
                      ? "Switch to edit mode"
                      : "Switch to preview mode"}
                    title={header.previewMode
                      ? "Switch to edit mode"
                      : "Switch to preview mode"}
                    onclick={(event) => {
                      header.onTogglePreview();
                    }}
                  >
                    {#if header.previewMode}
                      <Pencil />
                    {:else}
                      <BookOpen />
                    {/if}
                  </Button>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content>
                {header.previewMode ? "Edit" : "Preview"}
              </Tooltip.Content>
            </Tooltip.Root>
          {/if}
        {/if}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="size-8"
                aria-label="Review imports"
                onclick={(event) => {
                  header.onReviewImports();
                }}
              >
                <ClipboardList />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Review imports</Tooltip.Content>
        </Tooltip.Root>
      {/if}
    </div>
  {/if}
{/if}
