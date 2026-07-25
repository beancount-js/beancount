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
  import * as ToggleGroup from "@lapis/ui/shadcn/toggle-group";
  import CaseSensitive from "lucide-svelte/icons/case-sensitive";
  import Regex from "lucide-svelte/icons/regex";
  import WholeWord from "lucide-svelte/icons/whole-word";
  import ArrowUp from "lucide-svelte/icons/arrow-up";
  import ArrowDown from "lucide-svelte/icons/arrow-down";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import ChevronDown from "lucide-svelte/icons/chevron-down";

  import TextSelect from "lucide-svelte/icons/text-select";
  import Replace from "lucide-svelte/icons/replace";
  import ReplaceAll from "lucide-svelte/icons/replace-all";

  import X from "lucide-svelte/icons/x";
  import * as Tooltip from "@lapis/ui/shadcn/tooltip";

  import { debounceWithDelay } from "../../../hooks/debounce";
  import { Input } from "@lapis/ui/shadcn/input";
  import { buttonVariants } from "@lapis/ui/shadcn/button";

  export let view: EditorView;

  let noMatches: boolean = false;
  let searchValue = view.state.sliceDoc(
    view.state.selection.main.from,
    view.state.selection.main.to,
  );
  let replaceValue = "";

  let searchField: HTMLInputElement | undefined;
  let replaceField: HTMLInputElement | undefined;

  let query: SearchQuery = new SearchQuery({ search: "" });
  let isReplace: boolean = false;

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
      regexp: props.includes("regex"),
      replace: replaceValue,
      caseSensitive: props.includes("case"),
      wholeWord: props.includes("word"),
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

<div
  class="cn-beta-codemirror-src-codemirror-extensions-search-findreplace-132-1"
>
  <ToggleGroup.Root
    type="multiple"
    value={values()}
    size="sm"
    onValueChange={handlePropChange}
  >
    <ToggleGroup.Item
      value="case"
      aria-label="Match Case"
      class="cn-beta-codemirror-src-codemirror-extensions-search-findreplace-142-1"
    >
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger>
            <CaseSensitive
              class="cn-beta-codemirror-src-codemirror-extensions-search-findreplace-147-1"
            />
          </Tooltip.Trigger>
          <Tooltip.Content>
            <p>Case Sensitive</p>
          </Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    </ToggleGroup.Item>
    <ToggleGroup.Item value="word" aria-label="Match Whole Word" class="">
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger>
            <WholeWord
              class="cn-beta-codemirror-src-codemirror-extensions-search-findreplace-159-1"
            />
          </Tooltip.Trigger>
          <Tooltip.Content>
            <p>Whole Word</p>
          </Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    </ToggleGroup.Item>
    <ToggleGroup.Item
      value="regex"
      aria-label="Use Regular Expression"
      class=""
    >
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger>
            <Regex
              class="cn-beta-codemirror-src-codemirror-extensions-search-findreplace-175-1"
            />
          </Tooltip.Trigger>
          <Tooltip.Content>
            <p>Regex</p>
          </Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    </ToggleGroup.Item>
  </ToggleGroup.Root>
  <div
    class="cn-beta-codemirror-src-codemirror-extensions-search-findreplace-184-1"
  >
    <div
      class="cn-beta-codemirror-src-codemirror-extensions-search-findreplace-185-1"
    >
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger
            onclick={() => (isReplace = !isReplace)}
            class={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {#if isReplace}
              <ChevronDown />
            {:else}
              <ChevronRight />
            {/if}
          </Tooltip.Trigger>
          <Tooltip.Content>
            <p>Toggle Replace</p>
          </Tooltip.Content>
        </Tooltip.Root>
      </Tooltip.Provider>
    </div>
    <div
      class="cn-beta-codemirror-src-codemirror-extensions-search-findreplace-204-1"
    >
      <div
        class="cn-beta-codemirror-src-codemirror-extensions-search-findreplace-205-1"
      >
        <Input
          type="text"
          onkeydown={keydown}
          onkeyup={handleSearch}
          bind:value={searchValue}
          placeholder="Find"
          class="cn-beta-codemirror-src-codemirror-extensions-search-findreplace-212-1"
        />
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger
              onclick={searchPrevious}
              class={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ArrowUp />
            </Tooltip.Trigger>
            <Tooltip.Content>
              <p>Previous ⇧ F3</p>
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger
              onclick={searchNext}
              class={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ArrowDown />
            </Tooltip.Trigger>
            <Tooltip.Content>
              <p>Next F3</p>
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger
              onclick={searchAll}
              class={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <TextSelect />
            </Tooltip.Trigger>
            <Tooltip.Content>
              <p>Find all ⌥ Enter</p>
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger
              onclick={exitSearch}
              class={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <X />
            </Tooltip.Trigger>
            <Tooltip.Content>
              <p>Exit search</p>
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>
      {#if isReplace}
        <div
          class="cn-beta-codemirror-src-codemirror-extensions-search-findreplace-268-1"
        >
          <Input
            type="text"
            onkeydown={keydown}
            onkeyup={handleSearch}
            bind:value={replaceValue}
            placeholder="Replace"
            class="cn-beta-codemirror-src-codemirror-extensions-search-findreplace-275-1"
          />
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger
                onclick={replaceMatch}
                class={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Replace />
              </Tooltip.Trigger>
              <Tooltip.Content>
                <p>Replace Enter</p>
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
          <Tooltip.Provider>
            <Tooltip.Root>
              <Tooltip.Trigger
                onclick={replaceAllMatches}
                class={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ReplaceAll />
              </Tooltip.Trigger>
              <Tooltip.Content>
                <p>Replace all ⌘ ⌥ Enter</p>
              </Tooltip.Content>
            </Tooltip.Root>
          </Tooltip.Provider>
        </div>
      {/if}
    </div>
  </div>
</div>
