<script lang="ts">
  import FilterCommandPicker from "../../components/forms/FilterCommandPicker.svelte";
  import { accountPickerOption } from "../../components/forms/account-avatar";

  import "../codemirror/themes/base.scss";
  import type { DirectiveBase } from "@beancount-js/beancount";
  import type { ProjectSnapshot } from "@beancount-js/workspace";
  import {
    autosizeTextarea,
    ChipAutocomplete,
    CollapsibleItemList,
    EntryActions,
    FormField,
    FormSectionHeader,
    type FilterCommandOption,
    type FilterCommandSearchAction,
  } from "@lapismd/design-core/forms";
  import IconColorPicker from "../../components/forms/IconColorPicker.svelte";
  import TagEditor from "../../components/forms/TagEditor.svelte";
  import { getAllContexts, onDestroy } from "svelte";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Sheet from "@lapismd/design-core/shadcn/sheet";
  import { Switch } from "@lapismd/design-core/shadcn/switch";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import { ChevronsDownUp } from "@lucide/svelte";
  import { ChevronsUpDown } from "@lucide/svelte";
  import { CircleAlert } from "@lucide/svelte";
  import { X } from "@lucide/svelte";
  import { EditorView } from "@codemirror/view";
  import { EditorState } from "@codemirror/state";
  import { useContext } from "../context";
  import { basicSetup, ledgerSetup } from "../codemirror/beancount/setup";
  import { replaceContents } from "../codemirror/extensions/transactions";
  import { LedgerSource } from "../core/ledger";
  import {
    findDirectiveByRecordAnchor,
    journalRecordAnchor,
    journalRecordKey,
    type JournalRecordAnchor,
  } from "../lib/journal-record-key";
  import { useStudioWorkspace } from "../studio/workspace";
  import { useIngestionApi, ingestionPath } from "../ingestion/api";
  const { ingestionJson } = useIngestionApi();
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

  type SectionKey = "details" | "postings" | "metadata";
  type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

  type Props = {
    directive: DirectiveBase;
    open?: boolean;
    onRecordKeyChange?: (key: string) => void;
  };

  type Merchant = {
    merchantId: string;
    canonicalName: string;
    domain?: string;
    description?: string;
    aliases?: { normalizedValue: string }[];
    logoUrl?: string;
  };

  let {
    directive,
    open = $bindable(false),
    onRecordKeyChange = () => {},
  }: Props = $props();

  const { accounts, currencies, ledgerSource, tags: ledgerTags } = useContext();
  const editorContext = getAllContexts();
  const { snapshot, saveFile, refreshSnapshot } = useStudioWorkspace();

  const sectionTitleClass = "text-xs font-semibold uppercase tracking-wide";

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
  let recordAnchor = $state<JournalRecordAnchor | undefined>(undefined);
  let editor: EditorView | undefined;
  let replacing = false;
  let sheetTitleEl = $state<HTMLElement | null>(null);
  let sectionOpen = $state<Record<SectionKey, boolean>>({
    details: true,
    postings: true,
    metadata: true,
  });
  let merchants = $state<Merchant[]>([]);
  let merchantLoadError = $state("");
  let brandMatchBusy = $state(false);
  const kind = $derived(directiveKind(directive));
  const title = $derived(sheetTitleForKind(kind));
  const isYamlOnly = $derived(kind === "unknown");
  const parsedFromYaml = $derived(tryParseDirectiveDraft(rawSource, kind));
  const yamlSwitchDisabled = $derived(
    !isYamlOnly && !hasEditableAst(directive) && parsedFromYaml === null,
  );

  const accountItems = $derived($accounts.map(accountPickerOption));

  const currencySuggestions = $derived([...$currencies]);
  const merchantProjectId = $derived($snapshot?.project.id ?? "");
  const merchantOptions = $derived.by((): FilterCommandOption[] => {
    const listed = merchants.map((merchant) => ({
      value: merchant.merchantId,
      label: merchant.canonicalName,
      description: [merchant.domain, merchant.description]
        .filter(Boolean)
        .join("\n"),
      imageUrl: merchant.logoUrl,
      keywords: [
        merchant.canonicalName,
        ...(merchant.domain ? [merchant.domain] : []),
        ...(merchant.description ? [merchant.description] : []),
        ...(merchant.aliases?.map((alias) => alias.normalizedValue) ?? []),
      ],
    }));
    const selected = listed.find(
      (merchant) => merchant.value === draft.merchantId,
    );
    return [
      {
        value: "",
        label: "No merchant selected",
        description: "Use the account's colour and icon instead.",
      },
      ...(selected || !draft.merchantId
        ? listed
        : [
            {
              value: draft.merchantId,
              label: draft.merchantId,
              description: "Saved merchant is unavailable in this project.",
            },
            ...listed,
          ]),
    ];
  });

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

  async function loadMerchants(projectId: string) {
    try {
      const listed = await ingestionJson<Merchant[]>(
        ingestionPath(projectId, "/merchants"),
      );
      if (merchantProjectId !== projectId) return;
      merchants = Array.isArray(listed) ? listed : [];
      merchantLoadError = "";
    } catch (error) {
      if (merchantProjectId !== projectId) return;
      merchants = [];
      merchantLoadError =
        error instanceof Error ? error.message : "Failed to load merchants.";
    }
  }

  function domainFromUrl(value: string) {
    const input = value.trim();
    if (!input) return undefined;
    try {
      const url = new URL(
        /^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`,
      );
      const domain = url.hostname.toLowerCase().replace(/^(?:www\.|api\.)/, "");
      return domain.includes(".") ? domain : undefined;
    } catch {
      return undefined;
    }
  }

  function brandMatchAction(search: string): FilterCommandSearchAction | null {
    const domain = domainFromUrl(search);
    if (
      !merchantProjectId ||
      !draft.account.trim() ||
      !domain ||
      merchants.some((merchant) => merchant.domain?.toLowerCase() === domain)
    ) {
      return null;
    }
    return {
      label: `Fetch ${domain} with Brand Match`,
      description: "Create and select a merchant with its brand logo.",
    };
  }

  async function createMerchantFromBrandMatch(url: string) {
    const projectId = merchantProjectId;
    const account = draft.account.trim();
    if (brandMatchBusy || !projectId || !account) return;

    brandMatchBusy = true;
    merchantLoadError = "";
    try {
      const merchant = await ingestionJson<Merchant>(
        ingestionPath(projectId, "/merchants/brand-match"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, account }),
        },
      );
      if (merchantProjectId !== projectId) return;
      merchants = [
        merchant,
        ...merchants.filter((item) => item.merchantId !== merchant.merchantId),
      ].sort((left, right) =>
        left.canonicalName.localeCompare(right.canonicalName),
      );
      draft.merchantId = merchant.merchantId;
      scheduleSave();
    } catch (error) {
      merchantLoadError =
        error instanceof Error
          ? error.message
          : "Could not create a merchant from that URL.";
    } finally {
      brandMatchBusy = false;
    }
  }

  $effect(() => {
    const projectId = merchantProjectId;
    if (!projectId) {
      merchants = [];
      merchantLoadError = "";
      return;
    }
    void loadMerchants(projectId);
  });

  const codeMirror = (node: HTMLDivElement, source: string) => {
    editor = new EditorView({
      state: EditorState.create({
        doc: source,
        extensions: [
          basicSetup,
          ledgerSetup(() => $ledgerSource, editorContext),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !replacing) {
              rawSource = update.state.doc.toString();
              scheduleSave();
            }
          }),
        ],
      }),
      parent: node,
    });

    return {
      update(next: string) {
        if (editor && editor.state.doc.toString() !== next) {
          replacing = true;
          editor.dispatch({ ...replaceContents(editor.state, next) });
          replacing = false;
        }
      },
      destroy() {
        editor?.destroy();
        editor = undefined;
      },
    };
  };

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
    recordAnchor = journalRecordAnchor(value);
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

  function errorSignature(error: { message: string }) {
    return error.message;
  }

  function currentRecordAnchor(snapshot: ProjectSnapshot) {
    const savedAnchor = recordAnchor;
    if (!savedAnchor) {
      throw new Error(
        "This record is not attached to an editable project file.",
      );
    }
    const file = snapshot.ledgerFiles.find(
      (item) => item.path === savedAnchor.filename,
    );
    if (!file)
      throw new Error("The record's source file is no longer available.");

    if (
      file.contents.slice(savedAnchor.from, savedAnchor.to) ===
      savedAnchor.content
    ) {
      return { anchor: savedAnchor, file };
    }

    const refreshed = LedgerSource.fromProject(
      snapshot.project.entryFile,
      snapshot.ledgerFiles.map((item) => ({
        path: item.path,
        contents: item.contents,
      })),
      $ledgerSource.props,
    );
    const relocated = findDirectiveByRecordAnchor(
      refreshed.directives,
      savedAnchor,
    );
    const nextAnchor = relocated && journalRecordAnchor(relocated);
    if (!nextAnchor) {
      throw new Error(
        "This record changed in another editor. Reload it before saving.",
      );
    }
    const relocatedFile = snapshot.ledgerFiles.find(
      (item) => item.path === nextAnchor.filename,
    );
    if (!relocatedFile)
      throw new Error("The record's source file is no longer available.");

    recordAnchor = nextAnchor;
    onRecordKeyChange(journalRecordKey(relocated));
    return { anchor: nextAnchor, file: relocatedFile };
  }

  function isRevisionConflict(error: unknown) {
    return (
      error instanceof Error &&
      error.message.includes("File changed since it was read")
    );
  }

  async function persist(source: string, refreshed = false): Promise<void> {
    const currentSnapshot = $snapshot;
    if (!currentSnapshot) {
      throw new Error(
        "This record is not attached to an editable project file.",
      );
    }
    const { anchor, file } = currentRecordAnchor(currentSnapshot);
    const path = anchor.filename;
    const { from } = anchor;
    const { to } = anchor;
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
    const expectedRevision = currentSnapshot.revisions.find(
      (item) => item.path === path,
    )?.revision;
    try {
      await saveFile(path, contents, expectedRevision);
    } catch (error) {
      if (!refreshed && isRevisionConflict(error)) {
        await refreshSnapshot();
        return persist(source, true);
      }
      throw error;
    }

    const saved = findDirectiveByRecordAnchor(candidate.directives, {
      filename: path,
      content: source,
      from,
      to: from + source.length,
    });
    const nextAnchor = saved && journalRecordAnchor(saved);
    if (!nextAnchor) {
      throw new Error("Could not refresh the saved record's position.");
    }
    recordAnchor = nextAnchor;
    onRecordKeyChange(journalRecordKey(saved));
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
        ? (editor?.state.doc.toString() ?? rawSource)
        : buildDirectiveSource(formDirective, draft);
      await persist(source);
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
        if (editor) {
          replacing = true;
          editor.dispatch({ ...replaceContents(editor.state, nextSource) });
          replacing = false;
        }
      } catch {
        // keep existing rawSource if the form is incomplete
      }
      yamlMode = true;
      scheduleSave();
      return;
    }

    const source = editor?.state.doc.toString() ?? rawSource;
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
</script>

<Sheet.Root bind:open>
  <Sheet.Content
    side="right"
    showCloseButton={false}
    data-beancount-form-sheet
    data-journal-editor-sheet
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      sheetTitleEl?.focus();
    }}
  >
    <Sheet.Header
      class="flex h-11 shrink-0 flex-row items-center gap-2 space-y-0 border-b border-border px-3 text-left"
    >
      <Sheet.Title
        bind:ref={sheetTitleEl}
        tabindex={-1}
        class="journal-sheet-title min-w-0 flex-1 truncate leading-none outline-none"
      >
        {title}
      </Sheet.Title>
      <Sheet.Description class="sr-only">
        Edit this ledger record.
      </Sheet.Description>
      <div class="ml-auto flex shrink-0 items-center gap-1">
        {#if saveHint}
          <p class="text-xs text-muted-foreground" role="status">{saveHint}</p>
        {/if}
        {#if !isYamlOnly}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <div {...props} class="flex items-center gap-2">
                  <Switch
                    id="journal-yaml-mode"
                    size="sm"
                    checked={yamlMode}
                    disabled={yamlSwitchDisabled}
                    aria-label="YAML mode"
                    onCheckedChange={onYamlModeChange}
                  />
                  <label for="journal-yaml-mode" class="text-sm font-semibold"
                    >YAML</label
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
                  class="size-8"
                  aria-label={sectionsCollapsedAll
                    ? "Expand all"
                    : "Collapse all"}
                  onclick={(event) => {
                    const onClick = props.onclick as
                      | ((event: MouseEvent) => void)
                      | undefined;
                    onClick?.(event);
                    toggleCollapseAll();
                  }}
                >
                  {#if sectionsCollapsedAll}
                    <ChevronsUpDown class="size-4" aria-hidden="true" />
                  {:else}
                    <ChevronsDownUp class="size-4" aria-hidden="true" />
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
                class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                <X class="size-4" />
                <span class="sr-only">Close</span>
              </Sheet.Close>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Close</Tooltip.Content>
        </Tooltip.Root>
      </div>
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

      {#if yamlMode || isYamlOnly}
        <div class="grid gap-2 text-sm font-medium">
          <span id="record-source-label">Beancount source</span>
          <div
            class="beancount-editor min-h-[28rem] overflow-hidden rounded-md border border-input"
            role="textbox"
            aria-labelledby="record-source-label"
            aria-multiline="true"
          >
            <div use:codeMirror={rawSource} class="min-h-[28rem]"></div>
          </div>
        </div>
      {:else}
        <div class="journal-form flex min-w-0 flex-col gap-6 pl-6">
          <section class="flex flex-col gap-2" aria-label="Details">
            <FormSectionHeader
              index={0}
              total={1}
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
                  <FormField label="Date" align="center">
                    <Input
                      id="journal-date"
                      type="date"
                      bind:value={draft.date}
                      oninput={() => scheduleSave()}
                    />
                  </FormField>

                  {#if kind === "transaction"}
                    <FormField align="center" label="Flag">
                      <Input
                        id="journal-flag"
                        maxlength={1}
                        bind:value={draft.flag}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField align="center" label="Payee">
                      <Input
                        id="journal-payee"
                        bind:value={draft.payee}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField align="center" label="Narration">
                      <Input
                        id="journal-narration"
                        bind:value={draft.narration}
                        aria-invalid={!draft.narration.trim()}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField label="Tags" as="div" align="center">
                      <TagEditor
                        id="journal-tags"
                        value={draft.tags}
                        suggestions={$ledgerTags}
                        label="Tags"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add tag..."
                        onChange={(tags) => {
                          draft.tags = normalizeTags(tags);
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField label="Links" as="div" align="center">
                      <ChipAutocomplete
                        id="journal-links"
                        value={draft.links}
                        suggestions={[]}
                        label="Links"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add link..."
                        onChange={(links) => {
                          draft.links = normalizeLinks(links);
                          scheduleSave();
                        }}
                      />
                    </FormField>
                  {:else if kind === "open"}
                    <FormField label="Appearance" as="div" align="center">
                      <IconColorPicker
                        color={draft.color}
                        icon={draft.icon}
                        onChange={(appearance) => {
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
                      error={merchantLoadError || null}
                    >
                      <FilterCommandPicker
                        fullWidth
                        label="Merchant"
                        ariaLabel="Merchant"
                        placeholder="Search saved merchants..."
                        emptyLabel={merchants.length
                          ? "No matching merchants."
                          : "No saved merchants yet."}
                        stackedOptions
                        value={draft.merchantId}
                        options={merchantOptions}
                        searchAction={brandMatchAction}
                        searchActionGroupLabel="Brand Match"
                        onSearchAction={createMerchantFromBrandMatch}
                        onChange={(value) => {
                          draft.merchantId = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField label="Account" as="div" align="center">
                      <FilterCommandPicker
                        fullWidth
                        label="Account"
                        ariaLabel="Account"
                        placeholder="Filter accounts..."
                        value={draft.account}
                        options={accountItems}
                        onChange={(value) => {
                          draft.account = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField label="Currencies" as="div" align="center">
                      <ChipAutocomplete
                        id="journal-currencies"
                        value={draft.currencies}
                        suggestions={currencySuggestions}
                        label="Currencies"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add currency..."
                        onChange={(items) => {
                          draft.currencies = items;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField label="Booking" as="div" align="center">
                      <FilterCommandPicker
                        fullWidth
                        label="Booking"
                        ariaLabel="Booking method"
                        placeholder="Select booking..."
                        value={draft.booking || "DEFAULT"}
                        options={bookingOptions}
                        onChange={(value) => {
                          draft.booking = value as DirectiveDraft["booking"];
                          scheduleSave();
                        }}
                      />
                    </FormField>
                  {:else if kind === "close"}
                    <FormField label="Account" as="div" align="center">
                      <FilterCommandPicker
                        fullWidth
                        label="Account"
                        ariaLabel="Account"
                        placeholder="Filter accounts..."
                        value={draft.account}
                        options={accountItems}
                        onChange={(value) => {
                          draft.account = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                  {:else if kind === "commodity"}
                    <FormField align="center" label="Currency">
                      <Input
                        id="journal-currency"
                        bind:value={draft.currency}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                  {:else if kind === "pad"}
                    <FormField label="Source account" as="div" align="center">
                      <FilterCommandPicker
                        fullWidth
                        label="Source account"
                        ariaLabel="Source account"
                        placeholder="Filter accounts..."
                        value={draft.account}
                        options={accountItems}
                        onChange={(value) => {
                          draft.account = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField label="Target account" as="div" align="center">
                      <FilterCommandPicker
                        fullWidth
                        label="Target account"
                        ariaLabel="Target account"
                        placeholder="Filter accounts..."
                        value={draft.account2}
                        options={accountItems}
                        onChange={(value) => {
                          draft.account2 = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                  {:else if kind === "balance"}
                    <FormField label="Account" as="div" align="center">
                      <FilterCommandPicker
                        fullWidth
                        label="Account"
                        ariaLabel="Account"
                        placeholder="Filter accounts..."
                        value={draft.account}
                        options={accountItems}
                        onChange={(value) => {
                          draft.account = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField align="center" label="Amount">
                      <Input
                        id="journal-amount"
                        inputmode="decimal"
                        bind:value={draft.amount}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField align="center" label="Currency">
                      <Input
                        id="journal-currency"
                        bind:value={draft.currency}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField align="center" label="Tolerance">
                      <Input
                        id="journal-tolerance"
                        inputmode="decimal"
                        bind:value={draft.tolerance}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                  {:else if kind === "price"}
                    <FormField align="center" label="Currency">
                      <Input
                        id="journal-currency"
                        bind:value={draft.currency}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField align="center" label="Amount">
                      <Input
                        id="journal-amount"
                        inputmode="decimal"
                        bind:value={draft.amount}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField align="center" label="Amount currency">
                      <Input
                        id="journal-amount-currency"
                        bind:value={draft.currency2}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                  {:else if kind === "note"}
                    <FormField label="Account" as="div" align="center">
                      <FilterCommandPicker
                        fullWidth
                        label="Account"
                        ariaLabel="Account"
                        placeholder="Filter accounts..."
                        value={draft.account}
                        options={accountItems}
                        onChange={(value) => {
                          draft.account = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField align="center" label="Comment">
                      <Input
                        id="journal-comment"
                        bind:value={draft.comment}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField label="Tags" as="div" align="center">
                      <TagEditor
                        id="journal-tags"
                        value={draft.tags}
                        suggestions={$ledgerTags}
                        label="Tags"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add tag..."
                        onChange={(tags) => {
                          draft.tags = normalizeTags(tags);
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField label="Links" as="div" align="center">
                      <ChipAutocomplete
                        id="journal-links"
                        value={draft.links}
                        suggestions={[]}
                        label="Links"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add link..."
                        onChange={(links) => {
                          draft.links = normalizeLinks(links);
                          scheduleSave();
                        }}
                      />
                    </FormField>
                  {:else if kind === "document"}
                    <FormField label="Account" as="div" align="center">
                      <FilterCommandPicker
                        fullWidth
                        label="Account"
                        ariaLabel="Account"
                        placeholder="Filter accounts..."
                        value={draft.account}
                        options={accountItems}
                        onChange={(value) => {
                          draft.account = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField align="center" label="Path">
                      <Input
                        id="journal-path"
                        bind:value={draft.path}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField label="Tags" as="div" align="center">
                      <TagEditor
                        id="journal-tags"
                        value={draft.tags}
                        suggestions={$ledgerTags}
                        label="Tags"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add tag..."
                        onChange={(tags) => {
                          draft.tags = normalizeTags(tags);
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField label="Links" as="div" align="center">
                      <ChipAutocomplete
                        id="journal-links"
                        value={draft.links}
                        suggestions={[]}
                        label="Links"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add link..."
                        onChange={(links) => {
                          draft.links = normalizeLinks(links);
                          scheduleSave();
                        }}
                      />
                    </FormField>
                  {:else if kind === "event"}
                    <FormField align="center" label="Type">
                      <Input
                        id="journal-event-type"
                        bind:value={draft.eventType}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField align="center" label="Description">
                      <Input
                        id="journal-description"
                        bind:value={draft.description}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                  {:else if kind === "query"}
                    <FormField align="center" label="Name">
                      <Input
                        id="journal-query-name"
                        bind:value={draft.name}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField align="center" label="Query">
                      <textarea
                        id="journal-query"
                        class="flex min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        bind:value={draft.query}
                        use:autosizeTextarea={draft.query}
                        oninput={() => scheduleSave()}
                      ></textarea>
                    </FormField>
                  {:else if kind === "custom"}
                    <FormField align="center" label="Type">
                      <Input
                        id="journal-custom-type"
                        bind:value={draft.customType}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField label="Values" as="div" align="center">
                      <ChipAutocomplete
                        id="journal-custom-values"
                        value={draft.customValues}
                        suggestions={[]}
                        label="Values"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add value..."
                        onChange={(values) => {
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
                  onMove={(direction) => movePosting(index, direction)}
                  onRemove={() => removePosting(index)}
                >
                  <div class="beancount-structured-form">
                    <FormField label="Account" as="div" align="center">
                      <FilterCommandPicker
                        fullWidth
                        label="Account"
                        ariaLabel={`Posting ${index + 1} account`}
                        placeholder="Filter accounts..."
                        value={posting.account}
                        options={accountItems}
                        onChange={(value) => {
                          draft.postings[index].account = value;
                          scheduleSave();
                        }}
                      />
                    </FormField>
                    <FormField align="center" label="Amount">
                      <Input
                        id={`posting-${index}-amount`}
                        inputmode="decimal"
                        bind:value={posting.amount}
                        oninput={() => scheduleSave()}
                      />
                    </FormField>
                    <FormField align="center" label="Currency">
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
              {#each $currencies as currency (currency)}
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
                onMove={(direction) => moveMetadata(index, direction)}
                onRemove={() => removeMetadataRow(index)}
              >
                <div class="beancount-structured-form">
                  <FormField align="center" label="Key">
                    <Input
                      id={`meta-${index}-key`}
                      bind:value={row.key}
                      placeholder="Add key"
                      oninput={() => scheduleSave()}
                    />
                  </FormField>
                  <FormField align="center" label="Value">
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
