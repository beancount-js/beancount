<script lang="ts">
  import ArrowLeftRight from "lucide-svelte/icons/arrow-left-right";
  import BookOpen from "lucide-svelte/icons/book-open";
  import DatabaseZap from "lucide-svelte/icons/database-zap";
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import ClipboardList from "lucide-svelte/icons/clipboard-list";
  import Check from "lucide-svelte/icons/check";
  import FoldVertical from "lucide-svelte/icons/fold-vertical";
  import Landmark from "lucide-svelte/icons/landmark";
  import Pencil from "lucide-svelte/icons/pencil";
  import Play from "lucide-svelte/icons/play";
  import Plus from "lucide-svelte/icons/plus";
  import RefreshCw from "lucide-svelte/icons/refresh-cw";
  import Save from "lucide-svelte/icons/save";
  import ScanSearch from "lucide-svelte/icons/scan-search";
  import Settings2 from "lucide-svelte/icons/settings-2";
  import Sparkles from "lucide-svelte/icons/sparkles";
  import Store from "lucide-svelte/icons/store";
  import UnfoldVertical from "lucide-svelte/icons/unfold-vertical";
  import { FormToolbar } from "@beancount-js/forms";
  import CycleSelect from "./CycleSelect.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Menubar from "$lib/components/ui/menubar";
  import { Switch } from "$lib/components/ui/switch";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";

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
      <Menubar.Root
        class="h-8 space-x-0 rounded-none border-0 bg-transparent p-0 shadow-none"
      >
        <Menubar.Menu>
          <Menubar.Trigger
            class="h-8 cursor-pointer px-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >File</Menubar.Trigger
          >
          <Menubar.Content>
            <Menubar.Sub>
              <Menubar.SubTrigger class="pl-8">Open source</Menubar.SubTrigger>
              <Menubar.SubContent>
                {#each header.sources as file (file.path)}
                  <Menubar.CheckboxItem
                    checked={file.path === header.activePath}
                    onclick={() => header.onOpenSource(file.path)}
                    >{file.path}</Menubar.CheckboxItem
                  >
                {/each}
              </Menubar.SubContent>
            </Menubar.Sub>
            <Menubar.CheckboxItem
              checked={header.formatOnSave}
              onclick={() => header.onToggleFormatOnSave()}
            >
              Format on Save
            </Menubar.CheckboxItem>
            <Menubar.Item inset onclick={() => header.onGotoLine()}
              >Go To Line</Menubar.Item
            >
          </Menubar.Content>
        </Menubar.Menu>
        <Menubar.Menu>
          <Menubar.Trigger
            class="h-8 cursor-pointer px-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >Edit</Menubar.Trigger
          >
          <Menubar.Content>
            <Menubar.Item inset onclick={() => header.onFormat()}>
              Format <Menubar.Shortcut class="pl-2">⌘ + D</Menubar.Shortcut>
            </Menubar.Item>
            <Menubar.Item inset onclick={() => header.onToggleComment()}>
              Toggle Comment <Menubar.Shortcut class="pl-2"
                >⌘ + /</Menubar.Shortcut
              >
            </Menubar.Item>
            <Menubar.Item onclick={() => header.onUnfoldAll()}>
              <UnfoldVertical class="mr-2 size-4" /> Open all folds
            </Menubar.Item>
            <Menubar.Item onclick={() => header.onFoldAll()}>
              <FoldVertical class="mr-2 size-4" /> Close all folds
            </Menubar.Item>
            <Menubar.Separator />
            <Menubar.Sub>
              <Menubar.SubTrigger class="pl-8">Find</Menubar.SubTrigger>
              <Menubar.SubContent>
                <Menubar.Item onclick={() => header.onFind()}
                  >Find...</Menubar.Item
                >
                <Menubar.Item onclick={() => header.onFindNext()}
                  >Find Next</Menubar.Item
                >
                <Menubar.Item onclick={() => header.onFindPrevious()}
                  >Find Previous</Menubar.Item
                >
              </Menubar.SubContent>
            </Menubar.Sub>
            <Menubar.Separator />
            <Menubar.Item onclick={() => header.onAskAi()}>
              <Sparkles class="mr-2 size-4" /> Ask AI about selection
            </Menubar.Item>
          </Menubar.Content>
        </Menubar.Menu>
      </Menubar.Root>
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
        {#if header.canRerunAi || header.aiRerunBusy}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  size="icon"
                  variant="ghost"
                  class="size-8"
                  aria-label="Re-run AI enrichment"
                  title="Re-run AI merchant enrichment and categorisation on current proposals"
                  disabled={!header.canRerunAi || header.aiRerunBusy}
                  onclick={(event) => {
                    header.onRerunAi();
                  }}
                >
                  <Sparkles class={header.aiRerunBusy ? "animate-pulse" : ""} />
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>
              {header.aiRerunBusy
                ? "AI enrichment running…"
                : "Re-run AI enrichment"}
            </Tooltip.Content>
          </Tooltip.Root>
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
                aria-label="Detect merchants"
                disabled={!header.canDetect || header.detectBusy}
                onclick={(event) => {
                  header.onDetectMerchants();
                }}
              >
                <ScanSearch class={header.detectBusy ? "animate-pulse" : ""} />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>
            {header.detectBusy
              ? "Detecting merchants…"
              : "Run merchant detection on pending clusters"}
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
