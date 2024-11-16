<script lang="ts">
  import { EditorView, runScopeHandlers } from "@codemirror/view";
  import { ArrowDownToLine, X } from "lucide-svelte";
  import { closeGotoLine, dialogEffect, goToLine } from "../gotoline";

  export let view: EditorView;

  let lineField: HTMLInputElement;

  function exitSearch() {
    closeGotoLine(view);
  }

  const keydown = (e: KeyboardEvent) => {
    if (runScopeHandlers(view, e, "goto-panel")) {
      e.preventDefault();
    } else if (e.key == "Enter" && e.target == lineField) {
      e.preventDefault();
      handleSearch();
    } else if (e.key == "Escape") {
      // Escape
      e.preventDefault();
      view.dispatch({ effects: dialogEffect.of(false) });
      view.focus();
    }
  };

  function handleSearch() {
    goToLine(view, lineField.value);
  }

  function focus(el: HTMLElement) {
    el.focus();
  }
</script>

<div class="document-search-container mod-replace-mode">
  <div class="document-search">
    <input
      on:keydown={keydown}
      use:focus
      bind:this={lineField}
      class="document-search-input"
      type="text"
      placeholder="Go to line"
    />
    <div class="document-search-buttons">
      <button
        on:click={handleSearch}
        class="clickable-icon document-search-button"
        aria-label="Go to line"
        data-tooltip-position="top"
      >
        <ArrowDownToLine class="svg-icon lucide-arrow-down" />
      </button>
    </div>
    <button
      on:click={exitSearch}
      class="clickable-icon document-search-close-button"
      aria-label="Exit go to line"
      data-tooltip-position="top"
    >
      <X class="svg-icon" />
    </button>
  </div>
</div>
