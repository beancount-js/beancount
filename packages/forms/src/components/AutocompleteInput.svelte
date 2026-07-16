<script lang="ts">
  import { Portal } from "bits-ui";

  let {
    id = undefined,
    value = $bindable(""),
    suggestions = [] as readonly string[],
    placeholder = "",
    ariaLabel = "Autocomplete",
    autofocus = false,
    commitOnComma = false,
    commitOnBlur = false,
    commitOnTab = false,
    onCommit = () => {},
    onEmptyBackspace = () => {},
    onCancel = () => {},
  }: {
    id?: string;
    value?: string;
    suggestions?: readonly string[];
    placeholder?: string;
    ariaLabel?: string;
    autofocus?: boolean;
    commitOnComma?: boolean;
    commitOnBlur?: boolean;
    commitOnTab?: boolean;
    onCommit?: (value: string) => void | Promise<void>;
    onEmptyBackspace?: () => void | Promise<void>;
    onCancel?: () => void | Promise<void>;
  } = $props();

  let input = $state<HTMLInputElement | null>(null);
  let open = $state(false);
  let activeIndex = $state(0);
  let listPosition = $state({
    top: 0,
    left: 0,
    width: 288,
    transform: "",
  });
  const listId = `autocomplete-list-${Math.random().toString(36).slice(2)}`;

  const LIST_GAP_PX = 6;
  const LIST_MAX_HEIGHT_PX = 224;
  const LIST_ITEM_HEIGHT_PX = 36;

  const normalizedSuggestions = $derived.by(() => {
    const seen = new Set<string>();
    const needle = value.trim().toLowerCase();
    return suggestions
      .map((suggestion) => suggestion.trim())
      .filter(Boolean)
      .filter((suggestion) => {
        const key = suggestion.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return !needle || key.includes(needle);
      })
      .slice(0, 8);
  });

  const showList = $derived(open && normalizedSuggestions.length > 0);

  function updateListPosition() {
    if (!input) return;
    const rect = input.getBoundingClientRect();
    const width = Math.min(288, window.innerWidth * 0.8);
    const estimatedHeight = Math.min(
      normalizedSuggestions.length * LIST_ITEM_HEIGHT_PX + 8,
      LIST_MAX_HEIGHT_PX,
    );
    const spaceBelow = window.innerHeight - rect.bottom - LIST_GAP_PX;
    const spaceAbove = rect.top - LIST_GAP_PX;
    const placeAbove =
      spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    listPosition = {
      top: placeAbove ? rect.top - LIST_GAP_PX : rect.bottom + LIST_GAP_PX,
      left: rect.left,
      width,
      transform: placeAbove ? "translateY(-100%)" : "",
    };
  }

  $effect(() => {
    if (!autofocus) return;
    requestAnimationFrame(() => {
      input?.focus();
      input?.select();
    });
  });

  $effect(() => {
    if (!showList) return;

    void normalizedSuggestions.length;
    updateListPosition();

    const onReposition = () => updateListPosition();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);

    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  });

  function chooseSuggestion(suggestion: string) {
    value = suggestion;
    open = false;
    activeIndex = 0;
    void onCommit(suggestion);
  }

  function commitValue() {
    const committed = value.trim();
    if (!committed) return;
    open = false;
    void onCommit(committed);
  }

  function closeList() {
    open = false;
    activeIndex = 0;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      open = true;
      activeIndex = Math.min(
        activeIndex + 1,
        Math.max(normalizedSuggestions.length - 1, 0),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      open = true;
      activeIndex = Math.max(activeIndex - 1, 0);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (open && normalizedSuggestions[activeIndex]) {
        chooseSuggestion(normalizedSuggestions[activeIndex]);
      } else {
        commitValue();
      }
      return;
    }
    if (commitOnComma && event.key === ",") {
      event.preventDefault();
      commitValue();
      return;
    }
    if (event.key === "Tab") {
      if (commitOnTab && value.trim()) {
        commitValue();
      }
      closeList();
      return;
    }
    if (event.key === "Backspace" && !value) {
      void onEmptyBackspace();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      open = false;
      void onCancel();
    }
  }
</script>

<div class="autocomplete-input">
  <input
    {id}
    bind:this={input}
    bind:value
    {placeholder}
    aria-label={ariaLabel}
    aria-autocomplete="list"
    aria-controls={listId}
    aria-expanded={showList ? "true" : "false"}
    role="combobox"
    onfocus={() => (open = true)}
    oninput={() => {
      open = true;
      activeIndex = 0;
    }}
    onkeydown={handleKeydown}
    onblur={() => {
      if (commitOnBlur) {
        commitValue();
      }
      closeList();
    }}
  />
  {#if showList}
    <Portal>
      <div
        id={listId}
        class="autocomplete-list"
        role="listbox"
        style:top="{listPosition.top}px"
        style:left="{listPosition.left}px"
        style:width="{listPosition.width}px"
        style:transform={listPosition.transform || undefined}
      >
        {#each normalizedSuggestions as suggestion, index (suggestion)}
          <button
            type="button"
            role="option"
            class:active={index === activeIndex}
            aria-selected={index === activeIndex}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => chooseSuggestion(suggestion)}
          >
            {suggestion}
          </button>
        {/each}
      </div>
    </Portal>
  {/if}
</div>

<style>
  .autocomplete-input {
    position: relative;
    min-width: 0;
  }

  input {
    width: 100%;
    min-width: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    outline: none;
  }

  .autocomplete-list {
    position: fixed;
    z-index: 120;
    display: grid;
    max-height: 14rem;
    overflow: auto;
    border: 1px solid
      var(
        --cv-form-border,
        var(--beancount-form-border, var(--border))
      );
    border-radius: 0.45rem;
    background: var(--popover, var(--card, var(--background)));
    box-shadow: 0 14px 30px color-mix(in srgb, var(--foreground) 12%, transparent);
    padding: 0.25rem;
  }

  .autocomplete-list button {
    border: 0;
    border-radius: 0.3rem;
    background: transparent;
    color: var(--popover-foreground, var(--foreground));
    cursor: pointer;
    font: inherit;
    font-size: 0.86rem;
    font-weight: 600;
    padding: 0.45rem 0.55rem;
    text-align: left;
  }

  .autocomplete-list button:hover,
  .autocomplete-list button.active {
    background: var(--accent);
    color: var(--accent-foreground, var(--foreground));
  }
</style>
