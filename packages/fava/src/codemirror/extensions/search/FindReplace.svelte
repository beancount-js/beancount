<script lang="ts">
  import {
    closeSearchPanel,
    setSearchQuery,
    selectMatches,
    SearchQuery,
    findNext,
    findPrevious,
    replaceNext,
    replaceAll,
  } from "@codemirror/search";
  import { EditorView, runScopeHandlers } from "@codemirror/view";
  import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
  import { CaseSensitive, Regex, WholeWord } from "lucide-svelte";
  import { debounceWithDelay } from "../../../hooks/debounce";

  export let view: EditorView;

  let noMatches: boolean = false;
  let searchValue = view.state.sliceDoc(
    view.state.selection.main.from,
    view.state.selection.main.to,
  );
  let replaceValue = "";

  let searchField: HTMLInputElement;
  let replaceField: HTMLInputElement;

  let query: SearchQuery = new SearchQuery({ search: "" });

  function exitSearch() {
    closeSearchPanel(view);
  }

  function missingMatches(query: SearchQuery) {
    if (!query.search) {
      return false;
    }
    const cursor = query.getCursor(view.state);
    return cursor.next().done === true;
  }

  const [handleSearch] = debounceWithDelay((evt: any) => {
    const qs = new SearchQuery({
      search: searchValue,
      literal: query.literal,
      regexp: query.regexp,
      caseSensitive: query.caseSensitive,
      replace: replaceValue,
      wholeWord: query.wholeWord,
    });
    noMatches = missingMatches(qs);
    if (!qs.eq(query)) {
      view.dispatch({
        effects: setSearchQuery.of(qs),
      });
      query = qs;
    }
  }, 500);

  const keydown = (e: KeyboardEvent) => {
    if (runScopeHandlers(view, e, "search-panel")) {
      e.preventDefault();
    } else if (e.key == "Enter" && e.target == searchField) {
      e.preventDefault();
      (e.shiftKey ? findPrevious : findNext)(view);
    } else if (e.key == "Enter" && e.target == replaceField) {
      e.preventDefault();
      replaceNext(view);
    }
  };

  $: values = () => {
    const props: Array<string> = [];
    if (query.caseSensitive) {
      props.push("case");
    }
    if (query.wholeWord) {
      props.push("word");
    }
    if (query.regexp) {
      props.push("regex");
    }
    return props;
  };

  function focus(el: HTMLElement) {
    el.focus();
  }

  $: handlePropChange = (values: string[] | undefined) => {
    const props = values || [];
    const qs = new SearchQuery({
      search: searchValue,
      literal: query.literal,
      regexp: props.contains("regex"),
      replace: replaceValue,
      caseSensitive: props.contains("case"),
      wholeWord: props.contains("word"),
    });
    query = qs;
    noMatches = missingMatches(qs);
    view.dispatch({
      effects: setSearchQuery.of(qs),
    });
  };

  const searchNext = () => findNext(view);
  const searchPrevious = () => findPrevious(view);
  const searchAll = () => selectMatches(view);
  const replaceMatch = () => replaceNext(view);
  const replaceAllMatches = () => replaceAll(view);
</script>

<div class="document-search-container mod-replace-mode">
  <ToggleGroup.Root
    type="multiple"
    value={values()}
    size="sm"
    onValueChange={handlePropChange}
  >
    <ToggleGroup.Item
      value="case"
      aria-label="Match Case"
      class="!hover:border-none"
    >
      <CaseSensitive class="size-4" />
    </ToggleGroup.Item>
    <ToggleGroup.Item value="word" aria-label="Match Whole Word" class="">
      <WholeWord class="size-4" />
    </ToggleGroup.Item>
    <ToggleGroup.Item
      value="regex"
      aria-label="Use Regular Expression"
      class=""
    >
      <Regex class="size-4" />
    </ToggleGroup.Item>
  </ToggleGroup.Root>
  <div class="document-search">
    <input
      on:keydown={keydown}
      bind:value={searchValue}
      use:focus
      bind:this={searchField}
      on:keyup={handleSearch}
      class="document-search-input"
      class:mod-no-match={noMatches}
      type="text"
      placeholder="Find"
    />
    <div class="document-search-buttons">
      <button
        on:click={searchPrevious}
        class="clickable-icon document-search-button"
        aria-label="Previous ⇧ F3"
        data-tooltip-position="top"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="svg-icon lucide-arrow-up"
        >
          <path d="m5 12 7-7 7 7"></path><path d="M12 19V5"></path>
        </svg>
      </button>
      <button
        on:click={searchNext}
        class="clickable-icon document-search-button"
        aria-label="Next F3"
        data-tooltip-position="top"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="svg-icon lucide-arrow-down"
        >
          <path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path>
        </svg>
      </button>
      <button
        on:click={searchAll}
        class="clickable-icon document-search-button"
        aria-label="Find all ⌥ Enter"
        data-tooltip-position="top"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="svg-icon lucide-text-select"
        >
          <path d="M5 3a2 2 0 0 0-2 2"></path>
          <path d="M19 3a2 2 0 0 1 2 2"></path>
          <path d="M21 19a2 2 0 0 1-2 2"></path>
          <path d="M5 21a2 2 0 0 1-2-2"></path>
          <path d="M9 3h1"></path><path d="M9 21h1"></path>
          <path d="M14 3h1"></path><path d="M14 21h1"></path>
          <path d="M3 9v1"></path><path d="M21 9v1"></path>
          <path d="M3 14v1"></path><path d="M21 14v1"></path>
          <line x1="7" y1="8" x2="15" y2="8"></line><line
            x1="7"
            y1="12"
            x2="17"
            y2="12"
          ></line>
          <line x1="7" y1="16" x2="13" y2="16"></line>
        </svg>
      </button>
    </div>
    <button
      on:click={exitSearch}
      class="clickable-icon document-search-close-button"
      aria-label="Exit search"
      data-tooltip-position="top"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="svg-icon lucide-x"
      >
        <path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>
      </svg>
    </button>
  </div>
  <div class="document-replace">
    <input
      on:keydown={keydown}
      on:keyup={handleSearch}
      bind:value={replaceValue}
      bind:this={replaceField}
      class="document-replace-input"
      type="text"
      placeholder="Replace"
    />
    <div class="document-replace-buttons">
      <button
        on:click={replaceMatch}
        class="clickable-icon document-search-button"
        aria-label="Replace Enter"
        data-tooltip-position="top"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="svg-icon lucide-replace"
        >
          <path d="M14 4c0-1.1.9-2 2-2"></path>
          <path d="M20 2c1.1 0 2 .9 2 2"></path>
          <path d="M22 8c0 1.1-.9 2-2 2"></path>
          <path d="M16 10c-1.1 0-2-.9-2-2"></path>
          <path d="m3 7 3 3 3-3"></path>
          <path d="M6 10V5c0-1.7 1.3-3 3-3h1"></path>
          <rect x="2" y="14" width="8" height="8" rx="2"></rect>
        </svg>
      </button>
      <button
        on:click={replaceAllMatches}
        class="clickable-icon document-search-button"
        aria-label="Replace all ⌘ ⌥ Enter"
        data-tooltip-position="top"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="svg-icon lucide-replace-all"
        >
          <path d="M14 4c0-1.1.9-2 2-2"></path>
          <path d="M20 2c1.1 0 2 .9 2 2"></path>
          <path d="M22 8c0 1.1-.9 2-2 2"></path>
          <path d="M16 10c-1.1 0-2-.9-2-2"></path>
          <path d="m3 7 3 3 3-3"></path>
          <path d="M6 10V5c0-1.7 1.3-3 3-3h1"></path>
          <rect x="2" y="14" width="8" height="8" rx="2"></rect>
          <path d="M14 14c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2"></path>
          <path d="M20 14c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2"></path>
        </svg>
      </button>
    </div>
  </div>
</div>
