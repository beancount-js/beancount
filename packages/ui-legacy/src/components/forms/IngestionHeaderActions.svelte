<script lang="ts">
  import ArrowLeftRight from "lucide-svelte/icons/arrow-left-right";
  import BookOpen from "lucide-svelte/icons/book-open";
  import DatabaseZap from "lucide-svelte/icons/database-zap";
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
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
  import FormToolbar from "./FormToolbar.svelte";
  import CycleSelect from "./CycleSelect.svelte";
  import type { IngestionHeaderActions } from "./ingestion-header-actions";
  import { Button } from "../shadcn/button";
  import * as ButtonGroup from "../shadcn/button-group";
  import * as DropdownMenu from "../shadcn/dropdown-menu";
  import * as Menubar from "../shadcn/menubar";
  import { Switch } from "../shadcn/switch";
  import * as Tooltip from "../shadcn/tooltip";

  type Props = {
    region?: "leading" | "actions";
    header: IngestionHeaderActions;
  };
  let { region = "actions", header }: Props = $props();
</script>

{#if header}
  {#if region === "leading"}
    {#if header.kind === "ledger"}
      <Menubar.Root class="cn-forms-ingestionheaderactions-46-1">
        <Menubar.Menu>
          <Menubar.Trigger class="cn-forms-ingestionheaderactions-50-1"
            >File</Menubar.Trigger
          >
          <Menubar.Content>
            <Menubar.Sub>
              <Menubar.SubTrigger class="cn-forms-ingestionheaderactions-55-1"
                >Open source</Menubar.SubTrigger
              >
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
          <Menubar.Trigger class="cn-forms-ingestionheaderactions-79-1"
            >Edit</Menubar.Trigger
          >
          <Menubar.Content>
            <Menubar.Item inset onclick={() => header.onFormat()}>
              Format <Menubar.Shortcut
                class="cn-forms-ingestionheaderactions-84-1"
                >⌘ + D</Menubar.Shortcut
              >
            </Menubar.Item>
            <Menubar.Item inset onclick={() => header.onToggleComment()}>
              Toggle Comment <Menubar.Shortcut
                class="cn-forms-ingestionheaderactions-87-1"
                >⌘ + /</Menubar.Shortcut
              >
            </Menubar.Item>
            <Menubar.Item onclick={() => header.onUnfoldAll()}>
              <UnfoldVertical class="cn-forms-ingestionheaderactions-92-1" /> Open
              all folds
            </Menubar.Item>
            <Menubar.Item onclick={() => header.onFoldAll()}>
              <FoldVertical class="cn-forms-ingestionheaderactions-95-1" /> Close
              all folds
            </Menubar.Item>
            <Menubar.Separator />
            <Menubar.Sub>
              <Menubar.SubTrigger class="cn-forms-ingestionheaderactions-99-1"
                >Find</Menubar.SubTrigger
              >
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
              <Sparkles class="cn-forms-ingestionheaderactions-114-1" /> Ask AI about
              selection
            </Menubar.Item>
          </Menubar.Content>
        </Menubar.Menu>
      </Menubar.Root>
    {/if}
  {:else}
    <div
      class="cn-forms-ingestionheaderactions-122-1"
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
                class="cn-forms-ingestionheaderactions-134-1"
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
          {@const additionalActions = bulkAction.additionalActions ?? []}
          {@const hasEnabledAdditionalAction = additionalActions.some(
            (action) => !action.disabled,
          )}
          <ButtonGroup.Root aria-label={`${bulkAction.label} selected items`}>
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    type="button"
                    size="sm"
                    class="cn-forms-ingestionheaderactions-159-1"
                    aria-label={`${bulkAction.label} ${bulkAction.selectedCount} selected item${bulkAction.selectedCount === 1 ? "" : "s"}`}
                    disabled={!bulkAction.canRun || bulkAction.busy}
                    onclick={() => bulkAction.onRun()}
                  >
                    <Check data-icon="inline-start" />
                    {bulkAction.busy
                      ? `${bulkAction.busyLabel ?? bulkAction.label}…`
                      : `${bulkAction.label} ${bulkAction.selectedCount}`}
                  </Button>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content>
                {bulkAction.label} selected items
              </Tooltip.Content>
            </Tooltip.Root>
            <ButtonGroup.Separator />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    type="button"
                    size="icon"
                    class="cn-forms-ingestionheaderactions-183-1"
                    aria-label={`More ${bulkAction.label.toLowerCase()} actions`}
                    disabled={!bulkAction.canRun ||
                      bulkAction.busy ||
                      !hasEnabledAdditionalAction}
                  >
                    <ChevronDown
                      class="cn-forms-ingestionheaderactions-189-1"
                      aria-hidden="true"
                    />
                  </Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                {#each additionalActions as action (action.label)}
                  <DropdownMenu.Item
                    disabled={action.disabled || bulkAction.busy}
                    onSelect={() => action.onRun()}
                  >
                    {action.label}
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </ButtonGroup.Root>
        {:else}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  size="sm"
                  class="cn-forms-ingestionheaderactions-213-1"
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
                class="cn-forms-ingestionheaderactions-254-1"
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
                class="cn-forms-ingestionheaderactions-284-1"
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
                class="cn-forms-ingestionheaderactions-304-1"
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
                class="cn-forms-ingestionheaderactions-324-1"
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
                  class="cn-forms-ingestionheaderactions-347-1"
                  aria-label="Re-run AI enrichment"
                  title="Re-run AI merchant enrichment and categorisation on current proposals"
                  disabled={!header.canRerunAi || header.aiRerunBusy}
                  onclick={(event) => {
                    header.onRerunAi();
                  }}
                >
                  <Sparkles
                    class={header.aiRerunBusy
                      ? "cn-forms-ingestionheaderactions-355-1"
                      : ""}
                  />
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
                class="cn-forms-ingestionheaderactions-374-1"
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
                class="cn-forms-ingestionheaderactions-402-1"
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
        {#if header.bulkAction}
          {@const bulkAction = header.bulkAction}
          {@const additionalActions = bulkAction.additionalActions ?? []}
          {@const hasEnabledAdditionalAction = additionalActions.some(
            (action) => !action.disabled,
          )}
          <ButtonGroup.Root
            aria-label={`${bulkAction.label} selected merchant clusters`}
          >
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    type="button"
                    size="sm"
                    class="cn-forms-ingestionheaderactions-440-1"
                    aria-label={`${bulkAction.label} ${bulkAction.selectedCount} selected merchant cluster${bulkAction.selectedCount === 1 ? "" : "s"}`}
                    disabled={!bulkAction.canRun || bulkAction.busy}
                    onclick={() => bulkAction.onRun()}
                  >
                    <ScanSearch data-icon="inline-start" />
                    {bulkAction.busy
                      ? `${bulkAction.busyLabel ?? bulkAction.label}…`
                      : `${bulkAction.label} ${bulkAction.selectedCount}`}
                  </Button>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content>
                {bulkAction.label} selected merchant clusters
              </Tooltip.Content>
            </Tooltip.Root>
            <ButtonGroup.Separator />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    type="button"
                    size="icon"
                    class="cn-forms-ingestionheaderactions-464-1"
                    aria-label={`More ${bulkAction.label.toLowerCase()} actions`}
                    disabled={!bulkAction.canRun ||
                      bulkAction.busy ||
                      !hasEnabledAdditionalAction}
                  >
                    <ChevronDown
                      class="cn-forms-ingestionheaderactions-470-1"
                      aria-hidden="true"
                    />
                  </Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                {#each additionalActions as action (action.label)}
                  <DropdownMenu.Item
                    disabled={action.disabled || bulkAction.busy}
                    onSelect={() => action.onRun()}
                  >
                    {action.label}
                  </DropdownMenu.Item>
                {/each}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </ButtonGroup.Root>
        {:else}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  size="icon"
                  variant="ghost"
                  class="cn-forms-ingestionheaderactions-495-1"
                  aria-label="Detect merchants"
                  disabled={!header.canDetect || header.detectBusy}
                  onclick={(event) => {
                    header.onDetectMerchants();
                  }}
                >
                  <ScanSearch
                    class={header.detectBusy
                      ? "cn-forms-ingestionheaderactions-503-1"
                      : ""}
                  />
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>
              {header.detectBusy
                ? "Detecting merchants…"
                : "Run merchant detection on pending clusters"}
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
                class="cn-forms-ingestionheaderactions-523-1"
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
                class="cn-forms-ingestionheaderactions-543-1"
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
                class="cn-forms-ingestionheaderactions-563-1"
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
                class="cn-forms-ingestionheaderactions-592-1"
                aria-label="Backfill merchants from ledger"
                disabled={header.backfillBusy}
                onclick={(event) => {
                  header.onBackfill();
                }}
              >
                <DatabaseZap
                  class="cn-forms-ingestionheaderactions-599-1"
                  aria-hidden="true"
                />
                <span class="cn-forms-ingestionheaderactions-600-1"
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
                  class={header.syncAllBusy
                    ? "cn-forms-ingestionheaderactions-628-1"
                    : ""}
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
          <p class="cn-forms-ingestionheaderactions-644-1" role="status">
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
                class="cn-forms-ingestionheaderactions-656-1"
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
                class="cn-forms-ingestionheaderactions-677-1"
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
                  class="cn-forms-ingestionheaderactions-699-1"
                  aria-label={`Edit ${header.selectedCount} selected records`}
                  onclick={(event) => {
                    header.onReplace();
                  }}
                >
                  <ArrowLeftRight
                    class="cn-forms-ingestionheaderactions-705-1"
                  />
                  <span class="cn-forms-ingestionheaderactions-706-1"
                    >Edit ({header.selectedCount})</span
                  >
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
                class="cn-forms-ingestionheaderactions-722-1"
                aria-label={header.headersCollapsedAll
                  ? "Expand all headings"
                  : "Collapse all headings"}
                onclick={() => header.onToggleHeaders()}
              >
                {#if header.headersCollapsedAll}
                  <ChevronsUpDown />
                {:else}
                  <ChevronsDownUp />
                {/if}
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>
            {header.headersCollapsedAll
              ? "Expand all headings"
              : "Collapse all headings"}
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
                class="cn-forms-ingestionheaderactions-750-1"
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
      {:else if header.kind === "review-ledger"}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                size="icon"
                variant="ghost"
                class="cn-forms-ingestionheaderactions-771-1"
                aria-label={header.headersCollapsedAll
                  ? "Expand all date groups"
                  : "Collapse all date groups"}
                onclick={() => header.onToggleHeaders()}
              >
                {#if header.headersCollapsedAll}
                  <ChevronsUpDown />
                {:else}
                  <ChevronsDownUp />
                {/if}
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>
            {header.headersCollapsedAll
              ? "Expand all date groups"
              : "Collapse all date groups"}
          </Tooltip.Content>
        </Tooltip.Root>
      {:else if header.kind === "editor"}
        {#if header.saveHint}
          <p class="cn-forms-ingestionheaderactions-793-1" role="status">
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
                    class={header.syncAllBusy
                      ? "cn-forms-ingestionheaderactions-816-1"
                      : ""}
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
          <div class="cn-forms-ingestionheaderactions-840-1">
            <Switch
              id="ingestion-yaml-mode"
              size="sm"
              checked={header.yamlMode}
              aria-label="YAML mode"
              onCheckedChange={header.onYamlMode}
            />
            <label
              for="ingestion-yaml-mode"
              class="cn-forms-ingestionheaderactions-848-1">YAML</label
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
                    class="cn-forms-ingestionheaderactions-861-1"
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
                class="cn-forms-ingestionheaderactions-894-1"
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
