<script lang="ts">
  import { EditorView, runScopeHandlers } from "@codemirror/view";
  import { ArrowDownToLine } from "@lucide/svelte";
  import { X } from "@lucide/svelte";
  import { closeGotoLine, dialogEffect, goToLine } from "../gotoline";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { Button, buttonVariants } from "@lapismd/design-core/shadcn/button";
  import { onMount } from "svelte";
  import type { WithElementRef } from "bits-ui";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";

  let { ref = $bindable(null), view }: WithElementRef<{ view: EditorView }> =
    $props();

  let value: string = $state("");
  function exitSearch() {
    closeGotoLine(view);
  }

  const keydown = (e: KeyboardEvent) => {
    if (runScopeHandlers(view, e, "goto-panel")) {
      e.preventDefault();
    } else if (e.key == "Enter" && e.target == ref) {
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
    goToLine(view, value);
  }

  onMount(() => {
    setTimeout(() => {
      ref?.focus();
    });
  });
</script>

<div class="mx-4 flex flex-col py-2">
  <div class="mx-auto flex w-full gap-2">
    <Input
      onkeydown={keydown}
      type="text"
      bind:value
      bind:ref
      class="h-8 focus-visible:ring-2"
      placeholder="Go to line"
    />
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger
          onclick={handleSearch}
          class={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowDownToLine />
        </Tooltip.Trigger>
        <Tooltip.Content>
          <p>Go to line</p>
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
          <p>Exit go to line</p>
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  </div>
</div>
