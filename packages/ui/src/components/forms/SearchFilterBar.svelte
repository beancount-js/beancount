<script lang="ts">
  import "./SearchFilterBar.css";
  import { beancountFilter } from "@beancount-js/filters";
  import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
  import { syntaxHighlighting } from "@codemirror/language";
  import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
  import { Compartment, EditorState, type Extension } from "@codemirror/state";
  import {
    drawSelection,
    EditorView,
    keymap,
    placeholder as placeholderExtension,
  } from "@codemirror/view";
  import SearchIcon from "lucide-svelte/icons/search";
  import SlidersHorizontalIcon from "lucide-svelte/icons/sliders-horizontal";
  import XIcon from "lucide-svelte/icons/x";
  import type { Snippet } from "svelte";
  import { codeEditorHighlightStyle } from "./code-editor-theme";
  import {
    searchFilterCompletion,
    type SearchFilterSyntax,
  } from "./search-filter-syntax";

  let {
    value = "",
    placeholder = "Search...",
    ariaLabel = "Search",
    shortcut = "",
    disabled = false,
    inputId = undefined,
    /** `filter-query` uses CodeMirror + Beancount filter syntax; `plain` is a normal search input. */
    inputMode = "filter-query",
    clearSearchLabel = "Clear search",
    clearAllLabel = "Clear all",
    expandFiltersLabel = "Expand filter options",
    collapseFiltersLabel = "Collapse filter options",
    showActiveQueryChip = false,
    showClearAll = false,
    showFilterToggle = false,
    filtersExpanded = $bindable(false),
    clearAllDisabled = false,
    editorExtensions = [],
    filterSyntax = undefined,
    onValueChange = () => {},
    onClearSearch = () => {},
    onClearAll = () => {},
    filters,
    collapsedFilters,
    actions,
  }: {
    value?: string;
    placeholder?: string;
    ariaLabel?: string;
    shortcut?: string;
    disabled?: boolean;
    inputId?: string;
    inputMode?: "filter-query" | "plain";
    clearSearchLabel?: string;
    clearAllLabel?: string;
    expandFiltersLabel?: string;
    collapseFiltersLabel?: string;
    showActiveQueryChip?: boolean;
    showClearAll?: boolean;
    showFilterToggle?: boolean;
    filtersExpanded?: boolean;
    clearAllDisabled?: boolean;
    /** Extra CodeMirror extensions (e.g. themed syntax highlighting). */
    editorExtensions?: Extension[];
    /** Optional field, operator, and value completion plus inline syntax help. */
    filterSyntax?: SearchFilterSyntax;
    onValueChange?: (value: string) => void;
    onClearSearch?: () => void | Promise<void>;
    onClearAll?: () => void | Promise<void>;
    filters?: Snippet;
    collapsedFilters?: Snippet;
    actions?: Snippet;
  } = $props();

  let editor = $state<EditorView | null>(null);
  let plainInput = $state<HTMLInputElement | null>(null);
  let replacing = false;
  const editableCompartment = new Compartment();
  const placeholderCompartment = new Compartment();
  const autocompleteCompartment = new Compartment();

  const trimmedValue = $derived(value.trim());
  const hasValue = $derived(trimmedValue.length > 0);
  const hasFilterControls = $derived(Boolean(filters));
  const filtersVisible = $derived(
    Boolean(filters) && (!showFilterToggle || filtersExpanded),
  );
  const collapsedFiltersVisible = $derived(
    Boolean(collapsedFilters) &&
      showFilterToggle &&
      hasFilterControls &&
      !filtersExpanded,
  );

  function autocompleteExtension(): Extension {
    if (!filterSyntax || disabled || inputMode !== "filter-query") return [];
    return [
      autocompletion({
        override: [searchFilterCompletion(filterSyntax)],
        activateOnTyping: true,
      }),
      keymap.of(completionKeymap),
    ];
  }

  export function focus() {
    if (inputMode === "plain") {
      plainInput?.focus();
      return;
    }
    editor?.focus();
  }

  function toggleFilters() {
    filtersExpanded = !filtersExpanded;
  }

  function clearEditor() {
    if (inputMode === "plain") {
      if (value) onValueChange("");
      void onClearSearch();
      return;
    }
    if (editor && editor.state.doc.length > 0) {
      replacing = true;
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: "" },
      });
      replacing = false;
    }
    void onClearSearch();
  }

  function filterQueryEditor(node: HTMLDivElement, source: string) {
    const view = new EditorView({
      state: EditorState.create({
        doc: source,
        extensions: [
          beancountFilter(),
          syntaxHighlighting(codeEditorHighlightStyle, { fallback: true }),
          history(),
          drawSelection(),
          EditorView.lineWrapping,
          editableCompartment.of(EditorView.editable.of(!disabled)),
          placeholderCompartment.of(placeholderExtension(placeholder)),
          autocompleteCompartment.of(autocompleteExtension()),
          EditorView.contentAttributes.of({
            role: "searchbox",
            "aria-label": ariaLabel,
            ...(inputId ? { id: inputId } : {}),
          }),
          EditorView.editorAttributes.of({
            class: "cv-search-filter-bar__cm",
          }),
          EditorView.theme({
            ".cm-content": {
              caretColor: "var(--code-caret, var(--foreground, currentColor))",
            },
            "&.cm-focused .cm-cursor": {
              borderLeftColor:
                "var(--code-caret, var(--foreground, currentColor))",
              borderLeftWidth: "2px",
            },
          }),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !replacing) {
              onValueChange(update.state.doc.toString());
            }
          }),
          ...editorExtensions,
        ],
      }),
      parent: node,
    });
    editor = view;

    return {
      update(next: string) {
        if (view.state.doc.toString() === next) return;
        replacing = true;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: next },
        });
        replacing = false;
      },
      destroy() {
        view.destroy();
        if (editor === view) editor = null;
      },
    };
  }

  $effect(() => {
    editor?.dispatch({
      effects: editableCompartment.reconfigure(
        EditorView.editable.of(!disabled),
      ),
    });
  });

  $effect(() => {
    editor?.dispatch({
      effects: autocompleteCompartment.reconfigure(autocompleteExtension()),
    });
  });

  $effect(() => {
    editor?.dispatch({
      effects: placeholderCompartment.reconfigure(
        placeholderExtension(placeholder),
      ),
    });
  });
</script>

<div
  class="cv-search-filter-bar"
  data-active={hasValue}
  data-filters-expanded={filtersExpanded}
>
  <div class="cv-search-filter-bar__content">
    <span class="cv-search-filter-bar__label">{ariaLabel}</span>

    <div class="cv-search-filter-bar__search-pill">
      <SearchIcon size={12} strokeWidth={1.75} />
      {#if inputMode === "plain"}
        <input
          bind:this={plainInput}
          class="cv-search-filter-bar__plain-input"
          type="search"
          id={inputId}
          {value}
          {placeholder}
          {disabled}
          aria-label={ariaLabel}
          autocomplete="off"
          spellcheck="false"
          oninput={(event) =>
            onValueChange((event.currentTarget as HTMLInputElement).value)}
        />
      {:else}
        <div
          class="cv-search-filter-bar__editor"
          use:filterQueryEditor={value}
        ></div>
      {/if}
      {#if shortcut && !hasValue && (!showFilterToggle || filtersExpanded)}
        <kbd>{shortcut}</kbd>
      {/if}
      {#if showFilterToggle && hasFilterControls && !filtersExpanded}
        <button
          type="button"
          class="cv-search-filter-bar__filter-toggle cv-search-filter-bar__filter-toggle--inline"
          aria-label={expandFiltersLabel}
          aria-pressed={false}
          title={expandFiltersLabel}
          {disabled}
          onclick={toggleFilters}
        >
          <SlidersHorizontalIcon size={12} strokeWidth={1.75} />
        </button>
      {/if}
      {#if hasValue}
        <button
          type="button"
          class="cv-search-filter-bar__clear-search"
          aria-label={clearSearchLabel}
          title={clearSearchLabel}
          {disabled}
          onclick={clearEditor}
        >
          <XIcon size={12} strokeWidth={1.75} />
        </button>
      {/if}
    </div>

    {#if collapsedFiltersVisible && collapsedFilters}
      <div class="cv-search-filter-bar__collapsed-filters">
        {@render collapsedFilters()}
      </div>
    {/if}

    {#if showActiveQueryChip && hasValue}
      <button
        type="button"
        class="cv-search-filter-bar__query-chip"
        aria-label={`Clear search for ${trimmedValue}`}
        title={clearSearchLabel}
        {disabled}
        onclick={clearEditor}
      >
        <span>{trimmedValue}</span>
        <XIcon size={12} strokeWidth={1.75} />
      </button>
    {/if}

    {#if actions || (showFilterToggle && hasFilterControls) || showClearAll}
      <div class="cv-search-filter-bar__actions">
        {#if actions}
          {@render actions()}
        {/if}
        {#if showFilterToggle && hasFilterControls && filtersExpanded}
          <button
            type="button"
            class="cv-search-filter-bar__filter-toggle"
            aria-label={collapseFiltersLabel}
            aria-pressed={filtersExpanded}
            title={collapseFiltersLabel}
            {disabled}
            onclick={toggleFilters}
          >
            <SlidersHorizontalIcon size={12} strokeWidth={1.75} />
          </button>
        {/if}
        {#if showClearAll && !clearAllDisabled}
          <button
            type="button"
            class="cv-search-filter-bar__clear-all"
            aria-label={clearAllLabel}
            title={clearAllLabel}
            {disabled}
            onclick={() => onClearAll()}
          >
            <XIcon size={12} strokeWidth={1.75} />
          </button>
        {/if}
      </div>
    {/if}

    {#if filtersVisible && filters}
      <div class="cv-search-filter-bar__filters">
        {@render filters()}
      </div>
    {/if}

    {#if filtersVisible && filterSyntax}
      <details class="cv-search-filter-bar__syntax-help">
        <summary>{filterSyntax.title ?? "Search syntax"}</summary>
        <div class="cv-search-filter-bar__syntax-help-content">
          {#if filterSyntax.description}
            <p>{filterSyntax.description}</p>
          {/if}
          <dl>
            {#each filterSyntax.fields as field (field.name)}
              <div>
                <dt><code>{field.name}</code></dt>
                <dd>
                  <span>{field.description}</span>
                  <code>{field.operators.join(" ")}</code>
                  {#if field.aliases?.length}
                    <span class="cv-search-filter-bar__syntax-aliases"
                      >Aliases: {field.aliases.join(", ")}</span
                    >
                  {/if}
                </dd>
              </div>
            {/each}
          </dl>
          {#if filterSyntax.examples?.length}
            <ul>
              {#each filterSyntax.examples as example (example.query)}
                <li>
                  <code>{example.query}</code><span>{example.description}</span>
                </li>
              {/each}
            </ul>
          {/if}
          {#if filterSyntax.notes?.length}
            <ul class="cv-search-filter-bar__syntax-notes">
              {#each filterSyntax.notes as note (note)}
                <li>{note}</li>
              {/each}
            </ul>
          {/if}
        </div>
      </details>
    {/if}
  </div>
</div>
