<script lang="ts">
  import type { DirectiveBase } from "@beancount-js/beancount";
  import { autosizeTextarea } from "./autosize-textarea";
  import ChipAutocomplete from "./ChipAutocomplete.svelte";
  import CollapsibleItemList from "./CollapsibleItemList.svelte";
  import EntryActions from "./EntryActions.svelte";
  import FilterCommandPicker from "./FilterCommandPicker.svelte";
  import FormField from "./FormField.svelte";
  import FormSectionHeader from "./FormSectionHeader.svelte";
  import IconColorPicker from "./IconColorPicker.svelte";
  import TagEditor from "./TagEditor.svelte";
  import { onDestroy } from "svelte";
  import * as Alert from "../shadcn/alert";
  import { Button } from "../shadcn/button";
  import { Input } from "../shadcn/input";
  import * as Sheet from "../shadcn/sheet";
  import { Switch } from "../shadcn/switch";
  import * as Tooltip from "../shadcn/tooltip";
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import CircleAlert from "lucide-svelte/icons/circle-alert";
  import X from "lucide-svelte/icons/x";
  import CodeEditor from "./CodeEditor.svelte";
  import {
    bookingOptions,
    buildDirectiveSource,
    directiveKind,
    emptyDraft,
    hasEditableAst,
    loadDirectiveDraft,
    normalizeLinks,
    normalizeTags,
    sheetTitleForKind,
    tryParseDirectiveDraft,
    type DirectiveDraft,
  } from "./journal-editor/directive-draft";
  import MerchantPicker, {
    type MerchantPickerEmptyOption,
    type MerchantPickerMerchant,
  } from "./MerchantPicker.svelte";

  type SectionKey = "details" | "postings" | "metadata";
  type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

  type Props = {
    directive: DirectiveBase;
    accounts: readonly string[];
    currencies: readonly string[];
    tags?: readonly string[];
    merchants?: readonly MerchantPickerMerchant[];
    open?: boolean;
    merchantEmptyOption?: MerchantPickerEmptyOption;
    merchantLabel?: string;
    merchantAriaLabel?: string;
    onSave?: (source: string) => Promise<void> | void;
    onOpenChange?: (open: boolean) => void;
  };

  let {
    directive,
    accounts,
    currencies,
    tags = [],
    merchants = [],
    merchantEmptyOption,
    merchantLabel = "Merchant",
    merchantAriaLabel = merchantLabel,
    open = $bindable(false),
    onSave = () => {},
    onOpenChange,
  }: Props = $props();

  const sectionTitleClass = "cn-form-section-title";

  let formDirective = $state<DirectiveBase | undefined>(undefined);
  let draft = $state<DirectiveDraft>(emptyDraft());
  let loadedDirective = $state<DirectiveBase | undefined>(undefined);
  let yamlMode = $state(false);
  let rawSource = $state("");
  let errors = $state<string[]>([]);
  let saving = $state(false);
  let saveState = $state<SaveState>("idle");
  let saveTimer: number | null = null;
  let loadingDraft = $state(false);
  let sheetTitleEl = $state<HTMLElement | null>(null);
  let sectionOpen = $state<Record<SectionKey, boolean>>({
    details: true,
    postings: true,
    metadata: true,
  });
  const kind = $derived(directiveKind(directive));
  const title = $derived(sheetTitleForKind(kind));
  const isYamlOnly = $derived(kind === "unknown");
  const parsedFromYaml = $derived(tryParseDirectiveDraft(rawSource, kind));
  const yamlSwitchDisabled = $derived(
    !isYamlOnly && !hasEditableAst(directive) && parsedFromYaml === null,
  );

  const accountItems = $derived(
    [...accounts].map((account) => ({ label: account, value: account })),
  );

  const currencySuggestions = $derived([...currencies]);

  const sectionsCollapsedAll = $derived.by(() => {
    if (!isSectionOpen("details") || !isSectionOpen("metadata")) return true;
    if (kind === "transaction" && !isSectionOpen("postings")) return true;
    return false;
  });

  const saveHint = $derived(
    saveState === "dirty"
      ? "Unsaved changes…"
      : saveState === "saving"
        ? "Saving…"
        : saveState === "saved"
          ? "Saved"
          : saveState === "error"
            ? "Save failed"
            : "",
  );

  function isSectionOpen(key: SectionKey) {
    return sectionOpen[key] !== false;
  }

  function toggleSection(key: SectionKey) {
    sectionOpen = { ...sectionOpen, [key]: !isSectionOpen(key) };
  }

  function toggleCollapseAll() {
    if (sectionsCollapsedAll) {
      sectionOpen = { details: true, postings: true, metadata: true };
      return;
    }
    sectionOpen = { details: false, postings: false, metadata: false };
  }

  function loadFromDirective(value: DirectiveBase) {
    loadingDraft = true;
    formDirective = value;
    const nextKind = directiveKind(value);
    const ast = hasEditableAst(value);
    rawSource = value.content;
    draft = ast ? loadDirectiveDraft(value) : emptyDraft(nextKind);
    yamlMode = !ast || nextKind === "unknown";
    errors = [];
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveState = "idle";
    sectionOpen = { details: true, postings: true, metadata: true };
    loadingDraft = false;
  }

  $effect(() => {
    if (directive !== loadedDirective) {
      loadedDirective = directive;
      loadFromDirective(directive);
    }
  });

  function scheduleSave() {
    if (loadingDraft) return;
    saveState = "dirty";
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      void saveNow();
    }, 1200);
  }

  async function saveNow() {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (saving) return;
    saving = true;
    saveState = "saving";
    errors = [];
    try {
      if (!formDirective) {
        throw new Error("This record is not ready to save.");
      }
      const source = yamlMode
        ? rawSource
        : buildDirectiveSource(formDirective, draft);
      await onSave(source);
      // scheduleSave may mark dirty again while persist was in flight.
      saveState = (saveState as SaveState) === "dirty" ? "dirty" : "saved";
    } catch (error) {
      errors = [
        error instanceof Error ? error.message : "Unable to save this record.",
      ];
      saveState = "error";
    } finally {
      saving = false;
      if (saveState === "dirty") void saveNow();
    }
  }

  function onYamlModeChange(checked: boolean) {
    if (checked) {
      try {
        if (!formDirective) throw new Error("missing form directive");
        const nextSource = buildDirectiveSource(formDirective, draft);
        rawSource = nextSource;
      } catch {
        // keep existing rawSource if the form is incomplete
      }
      yamlMode = true;
      scheduleSave();
      return;
    }

    const source = rawSource;
    const parsed = tryParseDirectiveDraft(source, kind);
    if (!parsed) {
      errors = ["Could not parse Beancount source for this record type."];
      yamlMode = true;
      saveState = "error";
      return;
    }
    draft = parsed.draft;
    formDirective = parsed.directive;
    errors = [];
    yamlMode = false;
    scheduleSave();
  }

  function addPosting() {
    draft.postings = [
      ...draft.postings,
      { account: "", amount: "", currency: "" },
    ];
    scheduleSave();
  }

  function removePosting(index: number) {
    if (draft.postings.length <= 2) return;
    draft.postings = draft.postings.filter(
      (_, itemIndex) => itemIndex !== index,
    );
    scheduleSave();
  }

  function movePosting(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.postings.length) return;
    const next = [...draft.postings];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    draft.postings = next;
    scheduleSave();
  }

  function addMetadataRow() {
    draft.metadata = [...draft.metadata, { key: "", value: "" }];
    scheduleSave();
  }

  function removeMetadataRow(index: number) {
    draft.metadata = draft.metadata.filter((_, i) => i !== index);
    scheduleSave();
  }

  function moveMetadata(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.metadata.length) return;
    const next = [...draft.metadata];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    draft.metadata = next;
    scheduleSave();
  }

  $effect(() => {
    if (!open && saveState === "dirty") {
      void saveNow();
    }
  });

  onDestroy(() => {
    if (saveTimer) window.clearTimeout(saveTimer);
    if (saveState === "dirty") void saveNow();
  });

  function handleOpenChange(nextOpen: boolean) {
    open = nextOpen;
    onOpenChange?.(nextOpen);
  }

  function handleCodeSourceChange(nextSource: string) {
    rawSource = nextSource;
    if (yamlMode) {
      scheduleSave();
    }
  }
</script>

<Sheet.Root {open} onOpenChange={handleOpenChange}>
  <Sheet.Content
    side="right"
    class="cn-forms-journaleditorsheet-305-1"
    data-journal-editor-sheet
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      sheetTitleEl?.focus();
    }}
  >
    <Sheet.Header class="cn-forms-journaleditorsheet-313-1">
      <Sheet.Title
        bind:ref={sheetTitleEl}
        tabindex={-1}
        class="cn-forms-journaleditorsheet-318-1 journal-sheet-title"
      >
        {title}
      </Sheet.Title>
      <Sheet.Description class="sr-only">
        Edit this ledger record.
      </Sheet.Description>
      <div class="cn-forms-journaleditorsheet-325-1">
        {#if saveHint}
          <p class="cn-forms-journaleditorsheet-327-1" role="status">
            {saveHint}
          </p>
        {/if}
        {#if !isYamlOnly}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <div {...props} class="cn-forms-journaleditorsheet-333-1">
                  <Switch
                    id="journal-yaml-mode"
                    size="sm"
                    checked={yamlMode}
                    disabled={yamlSwitchDisabled}
                    aria-label="YAML mode"
                    onCheckedChange={onYamlModeChange}
                  />
                  <label
                    for="journal-yaml-mode"
                    class="cn-forms-journaleditorsheet-342-1">YAML</label
                  >
                </div>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>
              {yamlMode ? "Use form" : "Edit Beancount source"}
            </Tooltip.Content>
          </Tooltip.Root>
        {/if}
        {#if !yamlMode && !isYamlOnly}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  size="icon"
                  variant="ghost"
                  class="cn-forms-journaleditorsheet-362-1"
                  aria-label={sectionsCollapsedAll
                    ? "Expand all"
                    : "Collapse all"}
                  onclick={(event: MouseEvent) => {
                    const onClick = props.onclick as
                      | ((event: MouseEvent) => void)
                      | undefined;
                    onClick?.(event);
                    toggleCollapseAll();
                  }}
                >
                  {#if sectionsCollapsedAll}
                    <ChevronsUpDown
                      class="cn-forms-journaleditorsheet-375-1"
                      aria-hidden="true"
                    />
                  {:else}
                    <ChevronsDownUp
                      class="cn-forms-journaleditorsheet-377-1"
                      aria-hidden="true"
                    />
                  {/if}
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>
              {sectionsCollapsedAll ? "Expand all" : "Collapse all"}
            </Tooltip.Content>
          </Tooltip.Root>
        {/if}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Sheet.Close
                {...props}
                class="cn-forms-journaleditorsheet-392-1"
                aria-label="Close"
              >
                <X class="cn-forms-journaleditorsheet-395-1" />
                <span class="sr-only">Close</span>
              </Sheet.Close>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Close</Tooltip.Content>
        </Tooltip.Root>
      </div>
    </Sheet.Header>

    <div class="cn-forms-journaleditorsheet-405-1">
      {#if errors.length}
        <Alert.Root
          variant="destructive"
          class="cn-forms-journaleditorsheet-407-1"
        >
          <CircleAlert />
          <Alert.Title>Could not save record</Alert.Title>
          <Alert.Description class="cn-forms-journaleditorsheet-410-1"
            >{errors.join("\n")}</Alert.Description
          >
        </Alert.Root>
      {/if}

      {#if yamlMode || isYamlOnly}
        <div class="cn-forms-journaleditorsheet-417-1">
          <span id="record-source-label">Beancount source</span>
          <div
            class="cn-forms-journaleditorsheet-420-1"
            role="textbox"
            aria-labelledby="record-source-label"
            aria-multiline="true"
          >
            <CodeEditor
              bind:value={rawSource}
              language="yaml"
              minHeight="28rem"
              onChange={handleCodeSourceChange}
            />
          </div>
        </div>
      {:else}
        <div class="cn-forms-journaleditorsheet-434-1 journal-form">
          <section
            class="cn-forms-journaleditorsheet-435-1"
            aria-label="Details"
          >
            <FormSectionHeader
              title="Details"
              titleClass={sectionTitleClass}
              editable={false}
              movable={false}
              removable={false}
              titleToggleable={true}
              open={isSectionOpen("details")}
              onToggle={() => toggleSection("details")}
            />
            {#if isSectionOpen("details")}
              <div class="journal-section-body">
                <div class="beancount-structured-form">
                  <FormField
                    label="Date"
                    align="center"
                    controlId="journal-date"
                  >
                    <Input
                      id="journal-date"
                      type="date"
                      bind:value={draft.date}
                      oninput={() => scheduleSave()}
                    />
                  </FormField>

                  {#if kind === "transaction"}
                    <FormField label="Flag" controlId="journal-flag">
                      <Input
                        id="journal-flag"
                        maxlength={1}
                        bind:value={draft.flag}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField label="Payee" controlId="journal-payee">
                      <Input
                        id="journal-payee"
                        bind:value={draft.payee}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField label="Narration" controlId="journal-narration">
                      <Input
                        id="journal-narration"
                        bind:value={draft.narration}
                        aria-invalid={!draft.narration.trim()}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField
                      label="Tags"
                      as="div"
                      align="center"
                      controlId="journal-tags"
                    >
                      <TagEditor
                        id="journal-tags"
                        value={draft.tags}
                        suggestions={tags}
                        label="Tags"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add tag..."
                        onChange={(tags: string[]) => {
                          draft.tags = normalizeTags(tags);
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField
                      label="Links"
                      as="div"
                      align="center"
                      controlId="journal-links"
                    >
                      <ChipAutocomplete
                        id="journal-links"
                        value={draft.links}
                        suggestions={[]}
                        label="Links"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add link..."
                        onChange={(links: string[]) => {
                          draft.links = normalizeLinks(links);
                          scheduleSave();
                        }}
                      />
                    </FormField>
                  {:else if kind === "open"}
                    <FormField
                      label="Appearance"
                      as="div"
                      align="center"
                      controlId="journal-account-appearance"
                    >
                      <IconColorPicker
                        color={draft.color}
                        icon={draft.icon}
                        onChange={(appearance: {
                          color: string;
                          icon: string;
                        }) => {
                          draft.color = appearance.color;
                          draft.icon = appearance.icon;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField
                      label="Merchant"
                      as="div"
                      align="center"
                      controlId="journal-account-merchant"
                    >
                      <MerchantPicker
                        {merchants}
                        label={merchantLabel}
                        ariaLabel={merchantAriaLabel}
                        placeholder="Search saved merchants..."
                        value={draft.merchantId}
                        emptyOption={merchantEmptyOption ?? {
                          label: "No merchant selected",
                          description:
                            "Use the account's colour and icon instead.",
                        }}
                        onChange={(value: string) => {
                          draft.merchantId = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField
                      label="Account"
                      as="div"
                      align="center"
                      controlId="journal-account"
                    >
                      <FilterCommandPicker
                        fullWidth
                        label="Account"
                        ariaLabel="Account"
                        placeholder="Filter accounts..."
                        value={draft.account}
                        options={accountItems}
                        onChange={(value: string) => {
                          draft.account = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField
                      label="Currencies"
                      as="div"
                      align="center"
                      controlId="journal-currencies"
                    >
                      <ChipAutocomplete
                        id="journal-currencies"
                        value={draft.currencies}
                        suggestions={currencySuggestions}
                        label="Currencies"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add currency..."
                        onChange={(items: string[]) => {
                          draft.currencies = items;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField
                      label="Booking"
                      as="div"
                      align="center"
                      controlId="journal-booking"
                    >
                      <FilterCommandPicker
                        fullWidth
                        label="Booking"
                        ariaLabel="Booking method"
                        placeholder="Select booking..."
                        value={draft.booking || "DEFAULT"}
                        options={bookingOptions}
                        onChange={(value: string) => {
                          draft.booking = value as DirectiveDraft["booking"];
                          scheduleSave();
                        }}
                      />
                    </FormField>
                  {:else if kind === "close"}
                    <FormField
                      label="Account"
                      as="div"
                      align="center"
                      controlId="journal-account"
                    >
                      <FilterCommandPicker
                        fullWidth
                        label="Account"
                        ariaLabel="Account"
                        placeholder="Filter accounts..."
                        value={draft.account}
                        options={accountItems}
                        onChange={(value: string) => {
                          draft.account = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                  {:else if kind === "commodity"}
                    <FormField label="Currency" controlId="journal-currency">
                      <Input
                        id="journal-currency"
                        bind:value={draft.currency}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                  {:else if kind === "pad"}
                    <FormField
                      label="Source account"
                      as="div"
                      align="center"
                      controlId="journal-source-account"
                    >
                      <FilterCommandPicker
                        fullWidth
                        label="Source account"
                        ariaLabel="Source account"
                        placeholder="Filter accounts..."
                        value={draft.account}
                        options={accountItems}
                        onChange={(value: string) => {
                          draft.account = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField
                      label="Target account"
                      as="div"
                      align="center"
                      controlId="journal-target-account"
                    >
                      <FilterCommandPicker
                        fullWidth
                        label="Target account"
                        ariaLabel="Target account"
                        placeholder="Filter accounts..."
                        value={draft.account2}
                        options={accountItems}
                        onChange={(value: string) => {
                          draft.account2 = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                  {:else if kind === "balance"}
                    <FormField
                      label="Account"
                      as="div"
                      align="center"
                      controlId="journal-account"
                    >
                      <FilterCommandPicker
                        fullWidth
                        label="Account"
                        ariaLabel="Account"
                        placeholder="Filter accounts..."
                        value={draft.account}
                        options={accountItems}
                        onChange={(value: string) => {
                          draft.account = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField label="Amount" controlId="journal-amount">
                      <Input
                        id="journal-amount"
                        inputmode="decimal"
                        bind:value={draft.amount}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField label="Currency" controlId="journal-currency">
                      <Input
                        id="journal-currency"
                        bind:value={draft.currency}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField label="Tolerance" controlId="journal-tolerance">
                      <Input
                        id="journal-tolerance"
                        inputmode="decimal"
                        bind:value={draft.tolerance}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                  {:else if kind === "price"}
                    <FormField label="Currency" controlId="journal-currency">
                      <Input
                        id="journal-currency"
                        bind:value={draft.currency}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField label="Amount" controlId="journal-amount">
                      <Input
                        id="journal-amount"
                        inputmode="decimal"
                        bind:value={draft.amount}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField
                      label="Amount currency"
                      controlId="journal-amount-currency"
                    >
                      <Input
                        id="journal-amount-currency"
                        bind:value={draft.currency2}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                  {:else if kind === "note"}
                    <FormField
                      label="Account"
                      as="div"
                      align="center"
                      controlId="journal-account"
                    >
                      <FilterCommandPicker
                        fullWidth
                        label="Account"
                        ariaLabel="Account"
                        placeholder="Filter accounts..."
                        value={draft.account}
                        options={accountItems}
                        onChange={(value: string) => {
                          draft.account = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField label="Comment" controlId="journal-comment">
                      <Input
                        id="journal-comment"
                        bind:value={draft.comment}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField
                      label="Tags"
                      as="div"
                      align="center"
                      controlId="journal-tags"
                    >
                      <TagEditor
                        id="journal-tags"
                        value={draft.tags}
                        suggestions={tags}
                        label="Tags"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add tag..."
                        onChange={(tags: string[]) => {
                          draft.tags = normalizeTags(tags);
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField
                      label="Links"
                      as="div"
                      align="center"
                      controlId="journal-links"
                    >
                      <ChipAutocomplete
                        id="journal-links"
                        value={draft.links}
                        suggestions={[]}
                        label="Links"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add link..."
                        onChange={(links: string[]) => {
                          draft.links = normalizeLinks(links);
                          scheduleSave();
                        }}
                      />
                    </FormField>
                  {:else if kind === "document"}
                    <FormField
                      label="Account"
                      as="div"
                      align="center"
                      controlId="journal-account"
                    >
                      <FilterCommandPicker
                        fullWidth
                        label="Account"
                        ariaLabel="Account"
                        placeholder="Filter accounts..."
                        value={draft.account}
                        options={accountItems}
                        onChange={(value: string) => {
                          draft.account = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField label="Path" controlId="journal-path">
                      <Input
                        id="journal-path"
                        bind:value={draft.path}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField
                      label="Tags"
                      as="div"
                      align="center"
                      controlId="journal-tags"
                    >
                      <TagEditor
                        id="journal-tags"
                        value={draft.tags}
                        suggestions={tags}
                        label="Tags"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add tag..."
                        onChange={(tags: string[]) => {
                          draft.tags = normalizeTags(tags);
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField
                      label="Links"
                      as="div"
                      align="center"
                      controlId="journal-links"
                    >
                      <ChipAutocomplete
                        id="journal-links"
                        value={draft.links}
                        suggestions={[]}
                        label="Links"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add link..."
                        onChange={(links: string[]) => {
                          draft.links = normalizeLinks(links);
                          scheduleSave();
                        }}
                      />
                    </FormField>
                  {:else if kind === "event"}
                    <FormField label="Type" controlId="journal-event-type">
                      <Input
                        id="journal-event-type"
                        bind:value={draft.eventType}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField
                      label="Description"
                      controlId="journal-description"
                    >
                      <Input
                        id="journal-description"
                        bind:value={draft.description}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                  {:else if kind === "query"}
                    <FormField label="Name" controlId="journal-query-name">
                      <Input
                        id="journal-query-name"
                        bind:value={draft.name}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField label="Query" controlId="journal-query">
                      <textarea
                        id="journal-query"
                        class="cn-forms-journaleditorsheet-933-1"
                        bind:value={draft.query}
                        use:autosizeTextarea={draft.query}
                        oninput={() => scheduleSave()}
                      ></textarea>
                    </FormField>
                  {:else if kind === "custom"}
                    <FormField label="Type" controlId="journal-custom-type">
                      <Input
                        id="journal-custom-type"
                        bind:value={draft.customType}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField
                      label="Values"
                      as="div"
                      align="center"
                      controlId="journal-custom-values"
                    >
                      <ChipAutocomplete
                        id="journal-custom-values"
                        value={draft.customValues}
                        suggestions={[]}
                        label="Values"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add value..."
                        onChange={(values: string[]) => {
                          draft.customValues = values;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                  {/if}
                </div>
              </div>
            {/if}
          </section>

          {#if kind === "transaction"}
            <CollapsibleItemList
              title="Postings"
              addLabel="posting"
              count={draft.postings.length}
              open={isSectionOpen("postings")}
              onToggle={() => toggleSection("postings")}
              onAdd={addPosting}
            >
              {#each draft.postings as posting, index (index)}
                <EntryActions
                  {index}
                  total={draft.postings.length}
                  removeLabel={`Remove posting ${index + 1}`}
                  onMove={(direction: -1 | 1) => movePosting(index, direction)}
                  onRemove={() => removePosting(index)}
                >
                  <div class="beancount-structured-form">
                    <FormField
                      label="Account"
                      as="div"
                      align="center"
                      controlId={`posting-${index}-account`}
                    >
                      <FilterCommandPicker
                        fullWidth
                        label="Account"
                        ariaLabel={`Posting ${index + 1} account`}
                        placeholder="Filter accounts..."
                        value={posting.account}
                        options={accountItems}
                        onChange={(value: string) => {
                          draft.postings[index].account = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField
                      label="Amount"
                      controlId={`posting-${index}-amount`}
                    >
                      <Input
                        id={`posting-${index}-amount`}
                        inputmode="decimal"
                        bind:value={posting.amount}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField
                      label="Currency"
                      controlId={`posting-${index}-currency`}
                    >
                      <Input
                        id={`posting-${index}-currency`}
                        list="journal-currencies"
                        bind:value={posting.currency}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                  </div>
                </EntryActions>
              {/each}
            </CollapsibleItemList>
            <datalist id="journal-currencies">
              {#each currencySuggestions as currency (currency)}
                <option value={currency}></option>
              {/each}
            </datalist>
          {/if}

          <CollapsibleItemList
            title="Metadata"
            addLabel="field"
            count={draft.metadata.length}
            open={isSectionOpen("metadata")}
            onToggle={() => toggleSection("metadata")}
            onAdd={addMetadataRow}
          >
            {#each draft.metadata as row, index (index)}
              <EntryActions
                {index}
                total={draft.metadata.length}
                removeLabel={`Remove metadata ${index + 1}`}
                onMove={(direction: -1 | 1) => moveMetadata(index, direction)}
                onRemove={() => removeMetadataRow(index)}
              >
                <div class="beancount-structured-form">
                  <FormField label="Key" controlId={`meta-${index}-key`}>
                    <Input
                      id={`meta-${index}-key`}
                      bind:value={row.key}
                      placeholder="Add key"
                      oninput={() => scheduleSave()}
                    />
                  </FormField>
                  <FormField label="Value" controlId={`meta-${index}-value`}>
                    <Input
                      id={`meta-${index}-value`}
                      bind:value={row.value}
                      placeholder="Add value"
                      oninput={() => scheduleSave()}
                    />
                  </FormField>
                </div>
              </EntryActions>
            {/each}
          </CollapsibleItemList>
        </div>
      {/if}
    </div>
  </Sheet.Content>
</Sheet.Root>

<style>
  .journal-form :global(.beancount-structured-form) {
    min-width: 0;
  }

  .journal-section-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-left: 0.5rem;
    min-width: 0;
  }

  :global(.journal-sheet-title),
  .journal-form :global(.beancount-form-item-list-toggle),
  .journal-form :global(.beancount-form-section-title-toggle),
  .journal-form :global(.beancount-form-section-title-row h3) {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
</style>
